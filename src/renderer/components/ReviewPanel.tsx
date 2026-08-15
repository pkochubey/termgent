import React, { useState, useEffect, useCallback } from 'react';
import { GitDiffResult, GitDiffFile, GitDiffHunk, GitDiffLine } from '../../shared/types.js';
import {
  FileCode,
  FileText,
  RotateCw,
  X,
  ChevronDown,
  ChevronRight,
  GitBranch,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';

interface ReviewPanelProps {
  cwd: string;
  onClose: () => void;
}

function getFileTypeBadge(filePath: string): { label: string; color: string; bg: string } {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return { label: 'TS', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    case 'js':
    case 'jsx':
      return { label: 'JS', color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)' };
    case 'py':
      return { label: 'PY', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' };
    case 'rs':
      return { label: 'RS', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' };
    case 'go':
      return { label: 'GO', color: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.15)' };
    case 'json':
      return { label: 'JSON', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    case 'md':
      return { label: 'MD', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)' };
    case 'css':
    case 'scss':
      return { label: 'CSS', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    case 'html':
      return { label: 'HTML', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)' };
    default:
      return { label: ext.toUpperCase().slice(0, 4) || 'FILE', color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.15)' };
  }
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ cwd, onClose }) => {
  const [diffResult, setDiffResult] = useState<GitDiffResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

  const fetchDiff = useCallback(async () => {
    if (!cwd || !(window as any).electronAPI?.getGitDiff) return;
    setIsLoading(true);
    try {
      const res: GitDiffResult = await (window as any).electronAPI.getGitDiff(cwd);
      setDiffResult(res);
    } catch (e) {
      console.error('[ReviewPanel] Failed to load diff:', e);
    } finally {
      setIsLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  const toggleFileCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const collapseAll = () => {
    if (!diffResult) return;
    const next: Record<string, boolean> = {};
    diffResult.files.forEach((f) => (next[f.filePath] = true));
    setCollapsedFiles(next);
  };

  const expandAll = () => {
    setCollapsedFiles({});
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#0c0c0e',
        color: '#e4e4e7',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderLeft: '1px solid #1f1f23',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          backgroundColor: '#141416',
          borderBottom: '1px solid #1f1f23',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: '13px',
              backgroundColor: '#27272a',
              padding: '3px 9px',
              borderRadius: '4px',
              color: '#f4f4f5',
              letterSpacing: '0.3px',
            }}
          >
            Review
          </div>

          <div
            style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '4px',
              border: '1px solid #27272a',
              color: '#a1a1aa',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <GitBranch size={11} />
            <span>{diffResult?.branch || 'HEAD'}</span>
          </div>

          <div
            style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#71717a',
            }}
          >
            Working Tree
          </div>

          {diffResult && (
            <div style={{ fontSize: '12px', fontWeight: 600, display: 'flex', gap: '6px', marginLeft: '4px' }}>
              <span style={{ color: '#4ade80' }}>+{diffResult.totalAdditions}</span>
              <span style={{ color: '#f87171' }}>-{diffResult.totalDeletions}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={expandAll}
            title="Expand all files"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronsDown size={14} />
          </button>

          <button
            onClick={collapseAll}
            title="Collapse all files"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronsUp size={14} />
          </button>

          <button
            onClick={fetchDiff}
            title="Refresh Diff"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: isLoading ? '#3b82f6' : '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={onClose}
            title="Close Review Panel"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main Diff Content Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: '#09090b',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {isLoading && !diffResult && (
          <div style={{ color: '#71717a', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
            Loading working tree diff...
          </div>
        )}

        {!isLoading && diffResult && diffResult.files.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '60px',
              gap: '12px',
              color: '#71717a',
            }}
          >
            <CheckCircle2 size={36} style={{ color: '#10b981' }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>Working Tree Clean</div>
            <div style={{ fontSize: '12px', color: '#71717a' }}>
              No uncommitted changes on branch <span style={{ color: '#a1a1aa' }}>{diffResult.branch}</span>
            </div>
          </div>
        )}

        {diffResult &&
          diffResult.files.map((file) => {
            const isCollapsed = !!collapsedFiles[file.filePath];
            const badge = getFileTypeBadge(file.filePath);
            const pathParts = file.filePath.split(/[/\\]/);
            const fileName = pathParts.pop() || file.filePath;
            const dirPath = pathParts.join('/');

            return (
              <div
                key={file.filePath}
                style={{
                  borderRadius: '6px',
                  border: '1px solid #1f1f23',
                  backgroundColor: '#0d0d10',
                  overflow: 'hidden',
                }}
              >
                {/* File Header */}
                <div
                  onClick={() => toggleFileCollapse(file.filePath)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#161619',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: isCollapsed ? 'none' : '1px solid #1f1f23',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        color: badge.color,
                        backgroundColor: badge.bg,
                        flexShrink: 0,
                      }}
                    >
                      {badge.label}
                    </span>

                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#f4f4f5' }}>{fileName}</span>

                    {dirPath && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#71717a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {dirPath}
                      </span>
                    )}

                    {file.status === 'added' && (
                      <span style={{ fontSize: '10px', color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                        added
                      </span>
                    )}
                    {file.status === 'deleted' && (
                      <span style={{ fontSize: '10px', color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                        deleted
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, display: 'flex', gap: '6px' }}>
                      <span style={{ color: '#4ade80' }}>+{file.additions}</span>
                      <span style={{ color: '#f87171' }}>-{file.deletions}</span>
                    </div>

                    {isCollapsed ? <ChevronRight size={14} color="#71717a" /> : <ChevronDown size={14} color="#71717a" />}
                  </div>
                </div>

                {/* Diff Lines Table */}
                {!isCollapsed && (
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, Menlo, monospace',
                      fontSize: '12px',
                      lineHeight: '20px',
                      overflowX: 'auto',
                      backgroundColor: '#09090b',
                    }}
                  >
                    {file.isBinary ? (
                      <div style={{ padding: '16px', color: '#71717a', fontSize: '12px', fontStyle: 'italic' }}>
                        Binary file not shown.
                      </div>
                    ) : (
                      file.hunks.map((hunk, hIdx) => (
                        <div key={hIdx}>
                          {/* Hunk separator */}
                          {hIdx > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '6px 0',
                                backgroundColor: '#111114',
                                borderTop: '1px solid #1a1a1e',
                                borderBottom: '1px solid #1a1a1e',
                                color: '#71717a',
                                fontSize: '11px',
                                gap: '8px',
                              }}
                            >
                              <span style={{ color: '#52525b' }}>⋯</span>
                              <span>{hunk.header ? hunk.header : 'more lines'}</span>
                              <span style={{ color: '#52525b' }}>⋯</span>
                            </div>
                          )}

                          {/* Lines */}
                          {hunk.lines.map((line, lIdx) => {
                            const isAdd = line.type === 'add';
                            const isDel = line.type === 'delete';

                            const bg = isAdd
                              ? 'rgba(34, 197, 94, 0.12)'
                              : isDel
                              ? 'rgba(239, 68, 68, 0.12)'
                              : 'transparent';

                            const textColor = isAdd ? '#86efac' : isDel ? '#fca5a5' : '#e4e4e7';
                            const gutterColor = isAdd ? '#4ade80' : isDel ? '#f87171' : '#52525b';

                            return (
                              <div
                                key={lIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'stretch',
                                  backgroundColor: bg,
                                  minWidth: 'fit-content',
                                }}
                              >
                                {/* Old Line Number Column */}
                                <div
                                  style={{
                                    width: '38px',
                                    paddingRight: '6px',
                                    textAlign: 'right',
                                    color: gutterColor,
                                    userSelect: 'none',
                                    flexShrink: 0,
                                    fontSize: '11px',
                                    opacity: line.oldLineNumber ? 0.7 : 0,
                                  }}
                                >
                                  {line.oldLineNumber || ''}
                                </div>

                                {/* New Line Number Column */}
                                <div
                                  style={{
                                    width: '38px',
                                    paddingRight: '10px',
                                    textAlign: 'right',
                                    color: gutterColor,
                                    userSelect: 'none',
                                    flexShrink: 0,
                                    fontSize: '11px',
                                    borderRight: '1px solid #1f1f23',
                                    opacity: line.newLineNumber ? 0.7 : 0,
                                  }}
                                >
                                  {line.newLineNumber || ''}
                                </div>

                                {/* Line Indicator */}
                                <div
                                  style={{
                                    width: '16px',
                                    textAlign: 'center',
                                    color: gutterColor,
                                    fontWeight: 700,
                                    userSelect: 'none',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isAdd ? '+' : isDel ? '-' : ' '}
                                </div>

                                {/* Line Content */}
                                <div
                                  style={{
                                    paddingLeft: '4px',
                                    paddingRight: '12px',
                                    whiteSpace: 'pre',
                                    color: textColor,
                                    flex: 1,
                                  }}
                                >
                                  {line.content || ' '}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
