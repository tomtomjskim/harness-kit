import { describe, it, expect } from 'vitest';
import { HarnessConfigSchema, BaseModuleSchema, HookBodySchema, McpBodySchema } from '../../src/types/index.js';

describe('BaseModuleSchema', () => {
  it('valid instruction module', () => {
    const result = BaseModuleSchema.safeParse({
      name: 'korean-conventions',
      type: 'instruction',
      description: '한국어 프로젝트 공통 컨벤션',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid name (non-kebab)', () => {
    const result = BaseModuleSchema.safeParse({
      name: 'Korean_Conventions',
      type: 'instruction',
      description: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing description', () => {
    const result = BaseModuleSchema.safeParse({
      name: 'test',
      type: 'hook',
    });
    expect(result.success).toBe(false);
  });
});

describe('HookBodySchema', () => {
  it('valid hook with matcher', () => {
    const result = HookBodySchema.safeParse({
      event: 'PreToolUse',
      matcher: 'Bash',
      hooks: [{ type: 'command', command: './check.sh' }],
    });
    expect(result.success).toBe(true);
  });

  it('valid hook without matcher (optional)', () => {
    const result = HookBodySchema.safeParse({
      event: 'SessionStart',
      hooks: [{ type: 'command', command: './start.sh' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid event name', () => {
    const result = HookBodySchema.safeParse({
      event: 'InvalidEvent',
      hooks: [{ type: 'command', command: './x.sh' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('McpBodySchema', () => {
  it('valid mcp with args', () => {
    const result = McpBodySchema.safeParse({
      command: 'npx',
      args: ['serena-mcp@latest'],
    });
    expect(result.success).toBe(true);
  });

  it('valid mcp with env', () => {
    const result = McpBodySchema.safeParse({
      command: 'node',
      args: ['./dist/index.js'],
      env: { API_KEY: 'xxx' },
    });
    expect(result.success).toBe(true);
  });
});

describe('HarnessConfigSchema', () => {
  it('minimal valid config', () => {
    const result = HarnessConfigSchema.safeParse({
      version: '1',
      modules: [
        { name: 'korean-conventions' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('full config with custom and profiles', () => {
    const result = HarnessConfigSchema.safeParse({
      version: '1',
      name: 'my-project',
      preset: 'base',
      modules: [
        { name: 'typescript-strict', vars: { strict: true } },
        { name: 'docker-safety', when: { file_exists: 'Dockerfile' } },
      ],
      settings: { language: 'korean' },
      custom: [
        { id: 'deployment', section: '## Deployment', content: 'Deploy rules here' },
      ],
      profiles: {
        dev: { modules: [{ name: 'debug-verbose' }] },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid version', () => {
    const result = HarnessConfigSchema.safeParse({
      version: '2',
      modules: [],
    });
    expect(result.success).toBe(false);
  });
});
