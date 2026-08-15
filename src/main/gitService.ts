import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { GitStatus, GitDiffResult, GitDiffFile, GitDiffHunk, GitDiffLine } from '../shared/types.js';

export class GitService {
  private inFlight: Set<string> = new Set();
  private cache: Map<string, { status: GitStatus | undefined; timestamp: number }> = new Map();

  public async getGitStatus(cwd: string): Promise<GitStatus | undefined> {
    if (!cwd) return undefined;

    const now = Date.now();
    const cached = this.cache.get(cwd);
    if (cached && now - cached.timestamp < 2000) {
      return cached.status;
    }

    if (this.inFlight.has(cwd)) {
      return cached?.status;
    }

    this.inFlight.add(cwd);

    return new Promise((resolve) => {
      execFile(
        'git',
        ['-C', cwd, 'status', '--porcelain=v2', '--branch'],
        { timeout: 2000, maxBuffer: 1024 * 1024 },
        (error, stdout) => {
          this.inFlight.delete(cwd);

          if (error || !stdout) {
            this.cache.set(cwd, { status: undefined, timestamp: now });
            resolve(undefined);
            return;
          }

          const parsed = this.parsePorcelainV2(stdout);
          this.cache.set(cwd, { status: parsed, timestamp: now });
          resolve(parsed);
        }
      );
    });
  }

  public async getGitDiff(cwd: string): Promise<GitDiffResult> {
    if (!cwd) {
      return { cwd: '', branch: '', totalAdditions: 0, totalDeletions: 0, files: [] };
    }

    const status = await this.getGitStatus(cwd);
    const branch = status?.branch || 'HEAD';

    const diffOutput = await new Promise<string>((resolve) => {
      execFile(
        'git',
        ['-C', cwd, 'diff', 'HEAD', '--no-color', '--unified=3'],
        { timeout: 5000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout) => {
          if (err && !stdout) {
            // Fallback to git diff without HEAD if initial commit or detached
            execFile(
              'git',
              ['-C', cwd, 'diff', '--no-color', '--unified=3'],
              { timeout: 5000, maxBuffer: 10 * 1024 * 1024 },
              (_e, out) => resolve(out || '')
            );
          } else {
            resolve(stdout || '');
          }
        }
      );
    });

    const parsedFiles = this.parseUnifiedDiff(diffOutput);
    const existingFilePaths = new Set(parsedFiles.map((f) => f.filePath));

    // Also detect untracked newly created files
    const untrackedFiles = await this.getUntrackedFiles(cwd, existingFilePaths);
    const allFiles = [...parsedFiles, ...untrackedFiles];

    let totalAdditions = 0;
    let totalDeletions = 0;
    for (const file of allFiles) {
      totalAdditions += file.additions;
      totalDeletions += file.deletions;
    }

    return {
      cwd,
      branch,
      totalAdditions,
      totalDeletions,
      files: allFiles,
    };
  }

  private parsePorcelainV2(stdout: string): GitStatus | undefined {
    let branch = '';
    let upstream: string | undefined = undefined;
    let ahead = 0;
    let behind = 0;
    let dirty = 0;

    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.startsWith('# branch.head ')) {
        branch = line.substring(14).trim();
      } else if (line.startsWith('# branch.upstream ')) {
        upstream = line.substring(18).trim();
      } else if (line.startsWith('# branch.ab ')) {
        const ab = line.substring(12).trim().split(' ');
        if (ab.length >= 2) {
          ahead = Math.abs(parseInt(ab[0], 10) || 0);
          behind = Math.abs(parseInt(ab[1], 10) || 0);
        }
      } else if (
        line.startsWith('1 ') ||
        line.startsWith('2 ') ||
        line.startsWith('u ') ||
        line.startsWith('? ')
      ) {
        dirty++;
      }
    }

    if (!branch) return undefined;

    return {
      branch,
      upstream,
      ahead,
      behind,
      dirty,
    };
  }

  private parseUnifiedDiff(diffText: string): GitDiffFile[] {
    if (!diffText.trim()) return [];

    const files: GitDiffFile[] = [];
    const rawLines = diffText.split('\n');
    let currentFile: GitDiffFile | null = null;
    let currentHunk: GitDiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      // New file header
      if (line.startsWith('diff --git ')) {
        if (currentHunk && currentFile) {
          currentFile.hunks.push(currentHunk);
          currentHunk = null;
        }
        if (currentFile) {
          files.push(currentFile);
        }

        const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
        const oldPath = match ? match[1] : '';
        const newPath = match ? match[2] : '';

        currentFile = {
          filePath: newPath || oldPath,
          oldPath: oldPath !== newPath ? oldPath : undefined,
          status: 'modified',
          additions: 0,
          deletions: 0,
          hunks: [],
        };
        continue;
      }

      if (!currentFile) continue;

      if (line.startsWith('new file mode ')) {
        currentFile.status = 'added';
        continue;
      }
      if (line.startsWith('deleted file mode ')) {
        currentFile.status = 'deleted';
        continue;
      }
      if (line.startsWith('similarity index ') || line.startsWith('rename from ') || line.startsWith('rename to ')) {
        currentFile.status = 'renamed';
        continue;
      }
      if (line.startsWith('Binary files ') || line.includes('GIT binary patch')) {
        currentFile.isBinary = true;
        continue;
      }

      // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@ optional header
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
      if (hunkMatch) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }

        const oldStart = parseInt(hunkMatch[1], 10);
        const oldLines = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
        const newStart = parseInt(hunkMatch[3], 10);
        const newLines = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;

        oldLineNum = oldStart;
        newLineNum = newStart;

        currentHunk = {
          oldStart,
          oldLines,
          newStart,
          newLines,
          header: hunkMatch[5]?.trim() || '',
          lines: [],
        };
        continue;
      }

      if (!currentHunk) continue;

      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentFile.additions++;
        currentHunk.lines.push({
          type: 'add',
          content: line.substring(1),
          newLineNumber: newLineNum++,
        });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentFile.deletions++;
        currentHunk.lines.push({
          type: 'delete',
          content: line.substring(1),
          oldLineNumber: oldLineNum++,
        });
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.substring(1),
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      } else if (line === '\\ No newline at end of file') {
        // Ignore EOF marker
      }
    }

    if (currentHunk && currentFile) {
      currentFile.hunks.push(currentHunk);
    }
    if (currentFile) {
      files.push(currentFile);
    }

    return files;
  }

  private async getUntrackedFiles(cwd: string, existing: Set<string>): Promise<GitDiffFile[]> {
    return new Promise((resolve) => {
      execFile(
        'git',
        ['-C', cwd, 'status', '--porcelain'],
        { timeout: 3000, maxBuffer: 2 * 1024 * 1024 },
        (err, stdout) => {
          if (err || !stdout) {
            resolve([]);
            return;
          }

          const untracked: GitDiffFile[] = [];
          const lines = stdout.split('\n');

          for (const raw of lines) {
            if (!raw.startsWith('?? ')) continue;
            let relPath = raw.substring(3).trim();
            if (relPath.startsWith('"') && relPath.endsWith('"')) {
              relPath = relPath.slice(1, -1);
            }
            if (existing.has(relPath)) continue;

            const fullPath = path.join(cwd, relPath);
            try {
              if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) continue;
              const content = fs.readFileSync(fullPath, 'utf-8');
              const fileLines = content.split('\n');

              const hunkLines: GitDiffLine[] = fileLines.map((l, idx) => ({
                type: 'add',
                content: l,
                newLineNumber: idx + 1,
              }));

              untracked.push({
                filePath: relPath,
                status: 'added',
                additions: fileLines.length,
                deletions: 0,
                hunks: [
                  {
                    oldStart: 0,
                    oldLines: 0,
                    newStart: 1,
                    newLines: fileLines.length,
                    header: 'New untracked file',
                    lines: hunkLines,
                  },
                ],
              });
            } catch (e) {}
          }

          resolve(untracked);
        }
      );
    });
  }
}

