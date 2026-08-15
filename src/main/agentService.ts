import http from 'http';
import { exec } from 'child_process';
import { AgentType, LocalLlmInfo } from '../shared/types.js';

export interface AgentPreset {
  id: AgentType;
  name: string;
  command: string;
  icon: string;
  description: string;
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'antigravity',
    name: 'Antigravity (Gemini / Claude)',
    command: 'agy',
    icon: '🤖',
    description: 'Advanced Google DeepMind Agentic Coding Assistant',
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    command: 'codex',
    icon: '🧠',
    description: 'OpenAI Codex CLI Coding Agent',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot CLI',
    command: 'gh copilot',
    icon: '🐙',
    description: 'GitHub Copilot Terminal Assistant',
  },
  {
    id: 'qwen',
    name: 'Qwen Code (Local / Remote)',
    command: 'qwen-code',
    icon: '⚡',
    description: 'Alibaba Qwen 2.5 Coder Model Agent',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    icon: '🔮',
    description: 'Anthropic Claude Code CLI',
  },
];

export class AgentService {
  public async checkLocalLlm(): Promise<LocalLlmInfo> {
    // 1. Try Ollama (11434)
    try {
      const ollamaModels = await this.queryHttpJson('127.0.0.1', 11434, '/api/tags');
      if (ollamaModels && Array.isArray(ollamaModels.models)) {
        const names = ollamaModels.models.map((m: any) => m.name || m.model);
        return {
          available: true,
          provider: 'ollama',
          models: names,
        };
      }
    } catch (e) {}

    // 2. Try vLLM (8000)
    try {
      const vllmModels = await this.queryHttpJson('127.0.0.1', 8000, '/v1/models');
      if (vllmModels && Array.isArray(vllmModels.data)) {
        const names = vllmModels.data.map((m: any) => m.id);
        return {
          available: true,
          provider: 'vllm',
          models: names,
        };
      }
    } catch (e) {}

    // 3. Try LM Studio (1234)
    try {
      const lmModels = await this.queryHttpJson('127.0.0.1', 1234, '/v1/models');
      if (lmModels && Array.isArray(lmModels.data)) {
        const names = lmModels.data.map((m: any) => m.id);
        return {
          available: true,
          provider: 'lmstudio',
          models: names,
        };
      }
    } catch (e) {}

    return {
      available: false,
      provider: 'none',
      models: [],
    };
  }

  private queryHttpJson(host: string, port: number, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = http.get(
        {
          host,
          port,
          path,
          timeout: 1000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('timeout'));
      });
    });
  }

  public async detectInstalledAgents(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    const checkCommand = (cmd: string): Promise<boolean> => {
      return new Promise((resolve) => {
        exec(`where ${cmd}`, (err, stdout) => {
          resolve(!err && stdout.trim().length > 0);
        });
      });
    };

    results.antigravity = await checkCommand('agy');
    results.codex = await checkCommand('codex');
    results.copilot = await checkCommand('gh');
    results.qwen = (await checkCommand('qwen-code')) || (await checkCommand('ollama'));
    results.claude = await checkCommand('claude');

    return results;
  }
}
