import net from 'net';
import http from 'http';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const PIPE_PATH = '\\\\.\\pipe\\termgent-socket';
const HTTP_PORT = 9090;

function getControlConfig(): { port: number; pipe: string } {
  try {
    const configPath = path.join(process.env.LOCALAPPDATA || process.env.APPDATA || '.', 'termgent', 'control.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { port: data.port || HTTP_PORT, pipe: data.pipe || PIPE_PATH };
    }
  } catch (e) {}
  return { port: HTTP_PORT, pipe: PIPE_PATH };
}

async function sendRequest(command: string, args: Record<string, any> = {}): Promise<any> {
  const cfg = getControlConfig();
  const postData = JSON.stringify({ command, args });

  // 1. Try HTTP first
  try {
    return await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: cfg.port,
          path: '/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 2000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed.success) resolve(parsed.data);
              else reject(new Error(parsed.error || 'Command failed'));
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.on('error', (e) => reject(e));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(postData);
      req.end();
    });
  } catch (httpErr) {
    // 2. Try Named Pipe fallback
    return new Promise((resolve, reject) => {
      const client = net.createConnection(cfg.pipe, () => {
        client.write(postData + '\n');
      });
      let responseData = '';
      client.on('data', (chunk) => {
        responseData += chunk.toString('utf-8');
        if (responseData.endsWith('\n') || responseData.endsWith('\r')) {
          client.end();
        }
      });
      client.on('end', () => {
        try {
          const res = JSON.parse(responseData.trim());
          if (res.success) resolve(res.data);
          else reject(new Error(res.error || 'Command failed'));
        } catch (e) {
          reject(e);
        }
      });
      client.on('error', (err) => reject(err));
    });
  }
}

async function readStdin(): Promise<string[]> {
  if (process.stdin.isTTY) return [];
  const lines: string[] = [];
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}

async function main() {
  const argv = process.argv.slice(2);
  const isHelp = argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help';

  if (isHelp) {
    console.log(`
Termgent (tg) — terminal built for coding agents.

Usage:
  tg run <agent|command> [--split] [--cwd <dir>] [--workspace <ws>]
  tg attach [session-id]
  tg agents
  tg sessions
  tg status <active|blocked|completed|idle> [--target <target>]

  tg session list
  tg session new [--workspace <ws>] [--cwd <cwd>] [--name <name>] [--no-select]
  tg session select <target>
  tg session split [--target <target>] [--ratio <0.5>] [--focus <left|right>]
  tg session type <text> [--target <target>] [--pane <left|right>]
  tg session text [--target <target>] [--lines <N>] [--pane <left|right>]
  tg session status <active|blocked|completed|idle> [--target <target>]
  tg session hud <message> [--detail <detail>] [--spinner] [--position <pos>] [--close]
  tg session undo
  tg session close <target>

  tg workspace list
  tg workspace new <name>
  tg workspace rename <id> <name>

  tg pick [--prompt <prompt>] [options...]
  tg theme [campbell|oneDark|dracula|nord]
  tg hooks install [all|qwen|claude|codex|antigravity]
  tg tree [--json]

Note: 'termgent' and 'tg' can be used interchangeably.
`);
    process.exit(0);
  }

  // Drain stdin safely if piped from AI agent hook systems
  if (!process.stdin.isTTY) {
    process.stdin.on('data', () => {});
    process.stdin.resume();
  }

  const category = argv[0].toLowerCase();
  const sub = argv[1] ? argv[1].toLowerCase() : '';

  try {
    // 1. termgent run <agent|command...>
    if (category === 'run') {
      const commandOrAgent = argv[1];
      if (!commandOrAgent) {
        console.error('Usage: termgent run <agent|command> [--split] [--cwd <dir>] [--workspace <ws>]');
        process.exit(1);
      }

      const knownAgents = ['qwen', 'codex', 'antigravity', 'agy', 'claude', 'copilot'];
      const isAgent = knownAgents.includes(commandOrAgent.toLowerCase());

      let workspace = '';
      let cwd = '';
      let split = argv.includes('--split');

      for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--workspace' && argv[i + 1]) workspace = argv[++i];
        if (argv[i] === '--cwd' && argv[i + 1]) cwd = argv[++i];
      }

      if (isAgent) {
        const agentName = commandOrAgent.toLowerCase() === 'agy' ? 'antigravity' : commandOrAgent.toLowerCase();
        const res = await sendRequest('agent.start', { agent: agentName, workspace, cwd });
        if (split) {
          await sendRequest('session.split', { target: res.id });
        }
        console.log(`✓ Started AI Agent "${res.name}" in session ${res.id}`);
      } else {
        const fullCmd = argv.slice(1).filter((a) => !a.startsWith('--')).join(' ');
        const targetSession = process.env.TERMGENT_SESSION_ID;
        if (targetSession) {
          await sendRequest('session.type', { text: `${fullCmd}\r`, target: targetSession });
          console.log(`✓ Sent command to session ${targetSession}`);
        } else {
          const res = await sendRequest('session.new', { workspace, cwd, name: commandOrAgent });
          await sendRequest('session.type', { text: `${fullCmd}\r`, target: res.id });
          console.log(`✓ Created session "${res.name}" and executed command`);
        }
      }
    }
    // 2. termgent attach [session-id]
    else if (category === 'attach') {
      const target = argv[1] || '';
      const res = await sendRequest('session.select', { target });
      console.log(`✓ Attached to session "${res.name || res.id}" (${res.id})`);
    }
    // 3. termgent agents (alias for agent.list)
    else if (category === 'agents' || (category === 'agent' && sub === 'list')) {
      const res = await sendRequest('agent.list');
      console.log('\n🤖 Supported AI Coding Agents:');
      console.table(
        res.presets.map((p: any) => ({
          Agent: `${p.icon} ${p.name}`,
          CLI: p.command,
          Status: p.installed ? '✓ Available in PATH' : '✗ Not in PATH',
        }))
      );

      console.log('\n⚡ Local Offline LLM Status:');
      if (res.localLlm?.available) {
        console.log(`  Status: 🟢 Online (${res.localLlm.provider.toUpperCase()})`);
        console.log(`  Models: ${res.localLlm.models.join(', ') || 'Default'}`);
      } else {
        console.log('  Status: ⚪ Offline (Start Ollama / vLLM to use local offline models)');
      }
      console.log('');
    }
    // 4. termgent sessions (alias for session list)
    else if (category === 'sessions' || (category === 'session' && sub === 'list')) {
      const sList = await sendRequest('session.list');
      console.table(
        sList.map((s: any) => {
          const statusIcon =
            s.status === 'active' ? '🔵 Thinking' : s.status === 'blocked' ? '🟡 Approval' : s.status === 'completed' ? '🟢 Done' : '⚪ Idle';
          return {
            ID: s.id.substring(0, 8),
            Name: s.customName || s.name,
            Agent: s.agentType ? s.agentType.toUpperCase() : '-',
            Status: statusIcon,
            Branch: s.gitStatus?.branch || '-',
            Folder: s.currentCwd,
            Split: s.hasSplit ? 'Yes' : 'No',
          };
        })
      );
    }
    // 5. termgent status <status> (direct alias)
    else if (category === 'status') {
      const status = argv[1]; // active, blocked, completed, idle
      let target = process.env.TERMGENT_SESSION_ID || '';
      let verbose = false;
      for (let i = 1; i < argv.length; i++) {
        if (argv[i] === '--target' && argv[i + 1]) target = argv[++i];
        if (argv[i] === '--verbose' || argv[i] === '-v') verbose = true;
      }

      try {
        const res = await sendRequest('session.status', { status, target });
        if (verbose) {
          console.log(`Status set to ${res.status} for ${res.id}`);
        } else {
          console.log('{}');
        }
        process.exit(0);
      } catch (e: any) {
        console.log('{}');
        process.exit(0);
      }
    }
    // 5.1. termgent review
    else if (category === 'review') {
      const res = await sendRequest('session.review', { target: argv[1] || '' });
      console.log(`Review panel ${res.isReviewOpen ? 'opened' : 'closed'} for ${res.id}`);
    }
    // 6. termgent workspace ...
    else if (category === 'workspace') {
      if (sub === 'list') {
        const wsList = await sendRequest('workspace.list');
        console.table(wsList);
      } else if (sub === 'new') {
        const name = argv[2] || 'workspace';
        const res = await sendRequest('workspace.new', { name });
        console.log(`Created workspace "${res.name}" (${res.id})`);
      } else if (sub === 'rename') {
        const id = argv[2];
        const name = argv[3];
        await sendRequest('workspace.rename', { id, name });
        console.log(`Renamed workspace to "${name}"`);
      }
    }
    // 7. termgent session ...
    else if (category === 'session') {
      if (sub === 'new') {
        let workspace = '';
        let cwd = '';
        let name = '';
        let noSelect = false;

        for (let i = 2; i < argv.length; i++) {
          if (argv[i] === '--workspace' && argv[i + 1]) workspace = argv[++i];
          if (argv[i] === '--cwd' && argv[i + 1]) cwd = argv[++i];
          if (argv[i] === '--name' && argv[i + 1]) name = argv[++i];
          if (argv[i] === '--no-select') noSelect = true;
        }

        const res = await sendRequest('session.new', { workspace, cwd, name, noSelect });
        console.log(`Created session "${res.name}" (${res.id})`);
      } else if (sub === 'select') {
        const target = argv[2];
        const res = await sendRequest('session.select', { target });
        console.log(`Selected session ${res.id}`);
      } else if (sub === 'split') {
        let target = process.env.TERMGENT_SESSION_ID || '';
        let ratio = 0.5;
        let focus = '';

        for (let i = 2; i < argv.length; i++) {
          if (argv[i] === '--target' && argv[i + 1]) target = argv[++i];
          if (argv[i] === '--ratio' && argv[i + 1]) ratio = parseFloat(argv[++i]);
          if (argv[i] === '--focus' && argv[i + 1]) focus = argv[++i];
        }

        if (focus) {
          await sendRequest('session.split.focus', { target, focus });
          console.log(`Split focus set to ${focus}`);
        } else if (argv.includes('--ratio')) {
          await sendRequest('session.split.ratio', { target, ratio });
          console.log(`Split ratio set to ${ratio}`);
        } else {
          const res = await sendRequest('session.split', { target });
          console.log(`Split pane toggled: ${res.hasSplit ? 'ACTIVE' : 'CLOSED'}`);
        }
      } else if (sub === 'type') {
        let target = process.env.TERMGENT_SESSION_ID || '';
        let text = argv[2] || '';
        let pane = 'left';

        for (let i = 2; i < argv.length; i++) {
          if (argv[i] === '--target' && argv[i + 1]) target = argv[++i];
          if (argv[i] === '--pane' && argv[i + 1]) pane = argv[++i];
          if (argv[i] === '--text' && argv[i + 1]) text = argv[++i];
        }

        const res = await sendRequest('session.type', { text, target, pane });
        console.log(`Typed ${res.typed} chars into pane ${pane}`);
      } else if (sub === 'text') {
        let target = process.env.TERMGENT_SESSION_ID || '';
        let lines = 100;
        let pane = 'left';

        for (let i = 2; i < argv.length; i++) {
          if (argv[i] === '--target' && argv[i + 1]) target = argv[++i];
          if (argv[i] === '--lines' && argv[i + 1]) lines = parseInt(argv[++i], 10);
          if (argv[i] === '--pane' && argv[i + 1]) pane = argv[++i];
        }

        const text = await sendRequest('session.text', { target, lines, pane });
        console.log(text);
      } else if (sub === 'status') {
        const status = argv[2]; // active, blocked, completed, idle
        let target = process.env.TERMGENT_SESSION_ID || '';
        let verbose = false;
        for (let i = 2; i < argv.length; i++) {
          if (argv[i] === '--target' && argv[i + 1]) target = argv[++i];
          if (argv[i] === '--verbose' || argv[i] === '-v') verbose = true;
        }

        try {
          const res = await sendRequest('session.status', { status, target });
          if (verbose) {
            console.log(`Status set to ${res.status} for ${res.id}`);
          } else {
            console.log('{}');
          }
          process.exit(0);
        } catch (e: any) {
          console.log('{}');
          process.exit(0);
        }
      } else if (sub === 'hud') {
        let message = argv[2] || '';
        let detail = '';
        let position = 'top-right';
        let spinner = true;
        let close = argv.includes('--close');
        let target = process.env.TERMGENT_SESSION_ID || '';

        for (let i = 2; i < argv.length; i++) {
          if (argv[i] === '--detail' && argv[i + 1]) detail = argv[++i];
          if (argv[i] === '--position' && argv[i + 1]) position = argv[++i];
          if (argv[i] === '--no-spinner') spinner = false;
          if (argv[i] === '--target' && argv[i + 1]) target = argv[++i];
        }

        await sendRequest('session.hud', { message, detail, position, spinner, close, target });
        console.log(close ? 'HUD closed' : `HUD active: "${message}"`);
      } else if (sub === 'undo') {
        const res = await sendRequest('session.undo');
        console.log(`Restored session "${res.name}" in workspace ${res.workspaceId}`);
      } else if (sub === 'close') {
        const res = await sendRequest('session.close', { target: argv[2] });
        console.log(`Closed session ${res.closed}`);
      }
    }
    // 8. termgent pick
    else if (category === 'pick') {
      let prompt = 'Select option:';
      const options: string[] = [];

      for (let i = 1; i < argv.length; i++) {
        if ((argv[i] === '--prompt' || argv[i] === '--query') && argv[i + 1]) {
          prompt = argv[++i];
        } else if (!argv[i].startsWith('--')) {
          options.push(argv[i]);
        }
      }

      const stdinOptions = await readStdin();
      const allOptions = [...options, ...stdinOptions];

      const res = await sendRequest('pick', { prompt, options: allOptions });
      console.log(res);
    }
    // 9. termgent theme
    else if (category === 'theme') {
      const name = argv[1] || 'campbell';
      await sendRequest('theme', { name });
      console.log(`Theme set to ${name}`);
    }
    // 10. termgent hooks install
    else if (category === 'hooks' && sub === 'install') {
      const os = await import('os');
      const targetAgent = (argv[2] || 'all').toLowerCase();

      const tgCmdPath = path.join(os.homedir(), '.termgent', 'bin', 'tg.cmd');
      const cmdActive = `${tgCmdPath} status active`;
      const cmdCompleted = `${tgCmdPath} status completed`;

      if (targetAgent === 'qwen' || targetAgent === 'all') {
        const qwenSettingsPath = path.join(os.homedir(), '.qwen', 'settings.json');
        let settings: any = {};
        if (fs.existsSync(qwenSettingsPath)) {
          try {
            settings = JSON.parse(fs.readFileSync(qwenSettingsPath, 'utf-8'));
          } catch (e) {}
        }

        if (!settings.hooks) settings.hooks = {};
        settings.hooks.UserPromptSubmit = [
          { matcher: '.*', hooks: [{ type: 'command', command: cmdActive }] },
        ];
        settings.hooks.UserPromptSubmitted = [
          { matcher: '.*', hooks: [{ type: 'command', command: cmdActive }] },
        ];
        settings.hooks.PreToolUse = [
          { matcher: '.*', hooks: [{ type: 'command', command: cmdActive }] },
        ];
        settings.hooks.PostToolUse = [
          { matcher: '.*', hooks: [{ type: 'command', command: cmdActive }] },
        ];
        settings.hooks.Stop = [
          { matcher: '.*', hooks: [{ type: 'command', command: cmdCompleted }] },
        ];

        const qwenDir = path.dirname(qwenSettingsPath);
        if (!fs.existsSync(qwenDir)) fs.mkdirSync(qwenDir, { recursive: true });
        fs.writeFileSync(qwenSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        console.log(`✓ Installed native lifecycle hooks for Qwen Code in: ${qwenSettingsPath}`);
      }

      if (targetAgent === 'claude' || targetAgent === 'all') {
        const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        let settings: any = {};
        if (fs.existsSync(claudeSettingsPath)) {
          try {
            settings = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf-8'));
          } catch (e) {}
        }

        if (!settings.hooks) settings.hooks = {};
        settings.hooks.UserPromptSubmitted = [
          { matcher: '.*', hooks: [{ type: 'command', command: cmdActive }] },
        ];
        settings.hooks.PreToolUse = [
          { matcher: '.*', hooks: [{ type: 'command', command: cmdActive }] },
        ];
        settings.hooks.Stop = [
          { matcher: '.*', hooks: [{ type: 'command', command: cmdCompleted }] },
        ];

        const claudeDir = path.dirname(claudeSettingsPath);
        if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true });
        fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        console.log(`✓ Installed native lifecycle hooks for Claude Code in: ${claudeSettingsPath}`);
      }

      if (targetAgent === 'codex' || targetAgent === 'all') {
        const codexDir = path.join(os.homedir(), '.codex');
        if (!fs.existsSync(codexDir)) fs.mkdirSync(codexDir, { recursive: true });

        const codexConfigToml = path.join(codexDir, 'config.toml');

        if (fs.existsSync(codexConfigToml)) {
          let toml = fs.readFileSync(codexConfigToml, 'utf-8');
          const notifyLine = `notify = [ "${tgCmdPath.replace(/\\/g, '\\\\')}", "status", "completed" ]`;
          if (toml.includes('notify =')) {
            toml = toml.replace(/notify\s*=\s*\[[^\]]*\]/m, notifyLine);
          } else {
            toml = notifyLine + '\n' + toml;
          }
          if (toml.includes('[features]')) {
            toml = toml.replace(/hooks\s*=\s*false/g, 'hooks = true');
            if (!toml.includes('hooks =')) {
              toml = toml.replace('[features]', '[features]\nhooks = true');
            }
          } else {
            toml += '\n[features]\nhooks = true\n';
          }
          fs.writeFileSync(codexConfigToml, toml, 'utf-8');
        }

        const codexHooksPath = path.join(codexDir, 'hooks.json');
        const hooksConfig = {
          hooks: {
            UserPromptSubmit: [{ matcher: '.*', hooks: [{ type: 'command', command: cmdActive }] }],
            UserPromptSubmitted: [{ matcher: '.*', hooks: [{ type: 'command', command: cmdActive }] }],
            PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: cmdActive }] }],
            Stop: [{ matcher: '.*', hooks: [{ type: 'command', command: cmdCompleted }] }],
          },
        };
        fs.writeFileSync(codexHooksPath, JSON.stringify(hooksConfig, null, 2), 'utf-8');
        console.log(`✓ Installed native hooks and notification for OpenAI Codex in: ${codexDir}`);
      }

      if (targetAgent === 'antigravity' || targetAgent === 'agy' || targetAgent === 'all') {
        const agyHooksPath = path.join(os.homedir(), '.gemini', 'config', 'hooks.json');
        const agyRootHooksPath = path.join(os.homedir(), '.gemini', 'hooks.json');
        const hooksConfig: any = {
          'termgent-status': {
            enabled: true,
            PreInvocation: [{ type: 'command', command: cmdActive }],
            Stop: [{ type: 'command', command: cmdCompleted }],
          },
        };

        const agyDir = path.dirname(agyHooksPath);
        if (!fs.existsSync(agyDir)) fs.mkdirSync(agyDir, { recursive: true });
        fs.writeFileSync(agyHooksPath, JSON.stringify(hooksConfig, null, 2), 'utf-8');
        fs.writeFileSync(agyRootHooksPath, JSON.stringify(hooksConfig, null, 2), 'utf-8');
        console.log(`✓ Installed native lifecycle hooks for Antigravity in: ${agyHooksPath}`);
      }

      console.log('✓ All AI agent hooks installed successfully.');
    }
    // 11. termgent tree
    else if (category === 'tree') {
      const tree = await sendRequest('tree');
      if (argv.includes('--json')) {
        console.log(JSON.stringify(tree, null, 2));
      } else {
        console.log('\n📁 Termgent Tree:');
        for (const ws of tree.workspaces) {
          const isWsActive = ws.id === tree.activeWorkspaceId;
          console.log(`${isWsActive ? '▶' : ' '} [Workspace] ${ws.name} (${ws.id.substring(0, 8)})`);
          for (const sid of ws.sessionIds) {
            const s = tree.sessions[sid];
            if (s) {
              const isSActive = sid === tree.activeSessionId;
              const statusIcon = s.status === 'active' ? '🔵' : s.status === 'blocked' ? '🟡' : s.status === 'completed' ? '🟢' : '⚪';
              const splitTag = s.hasSplit ? ' [SPLIT]' : '';
              console.log(`    ${isSActive ? '→' : ' '} ${statusIcon} ${s.customName || s.name} (${s.currentCwd})${splitTag}`);
            }
          }
        }
        console.log('');
      }
    } else {
      console.error(`Unknown command: ${category} ${sub || ''}`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
