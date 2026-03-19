import { describe, it, expect } from 'vitest';
import { merge } from '../../src/pipeline/merger.js';
import { DuplicateMcpKeyError } from '../../src/errors.js';
import type { ValidatedModule } from '../../src/pipeline/validator.js';

function makeModule(
  overrides: Partial<Omit<ValidatedModule, 'name' | 'frontmatter'>> & {
    name: string;
    type: string;
    frontmatterExtra?: Record<string, unknown>;
  },
): ValidatedModule {
  return {
    name: overrides.name,
    frontmatter: {
      name: overrides.name,
      type: overrides.type as never,
      description: 'test',
      tags: [],
      priority: 50,
      dependencies: [],
      ...(overrides.frontmatterExtra ?? {}),
    },
    body: overrides.body ?? '',
    rawContent: '',
    filePath: `/test/${overrides.name}.md`,
    vars: overrides.vars,
  };
}

// ---- Instruction merging ----

describe('mergeInstructions', () => {
  it('같은 section의 모듈 2개 → 선언 순서대로 append', () => {
    const modules = [
      makeModule({ name: 'mod-a', type: 'instruction', body: 'content A', frontmatterExtra: { section: '## Rules' } }),
      makeModule({ name: 'mod-b', type: 'instruction', body: 'content B', frontmatterExtra: { section: '## Rules' } }),
    ];
    const result = merge(modules, []);
    // Both under same section heading, A before B
    expect(result.claudeMd).toContain('## Rules');
    const posA = result.claudeMd.indexOf('content A');
    const posB = result.claudeMd.indexOf('content B');
    expect(posA).toBeGreaterThanOrEqual(0);
    expect(posB).toBeGreaterThanOrEqual(0);
    expect(posA).toBeLessThan(posB);
  });

  it('다른 section의 모듈 2개 → 각 section 헤딩 아래에 분리', () => {
    const modules = [
      makeModule({ name: 'mod-a', type: 'instruction', body: 'content A', frontmatterExtra: { section: '## Section1' } }),
      makeModule({ name: 'mod-b', type: 'instruction', body: 'content B', frontmatterExtra: { section: '## Section2' } }),
    ];
    const result = merge(modules, []);
    expect(result.claudeMd).toContain('## Section1');
    expect(result.claudeMd).toContain('## Section2');
    expect(result.claudeMd).toContain('content A');
    expect(result.claudeMd).toContain('content B');
    expect(result.claudeMd.indexOf('## Section1')).toBeLessThan(result.claudeMd.indexOf('content A'));
    expect(result.claudeMd.indexOf('## Section2')).toBeLessThan(result.claudeMd.indexOf('content B'));
  });

  it('section 없는 모듈 → "## General" 기본 섹션', () => {
    const modules = [
      makeModule({ name: 'mod-a', type: 'instruction', body: 'no section content' }),
    ];
    const result = merge(modules, []);
    expect(result.claudeMd).toContain('## General');
    expect(result.claudeMd).toContain('no section content');
  });
});

// ---- Hook merging ----

describe('mergeHooks', () => {
  it('같은 event의 hook 2개 → handlers 배열 누적', () => {
    const modules = [
      makeModule({
        name: 'hook-a',
        type: 'hook',
        body: { event: 'PreToolUse', matcher: 'Bash', hooks: [{ type: 'command', command: './hook-a.sh' }] },
      }),
      makeModule({
        name: 'hook-b',
        type: 'hook',
        body: { event: 'PreToolUse', matcher: 'Bash', hooks: [{ type: 'command', command: './hook-b.sh' }] },
      }),
    ];
    const result = merge(modules, []);
    const settings = result.settingsJson as { hooks: Record<string, unknown[]> };
    expect(settings.hooks['PreToolUse']).toHaveLength(2);
    const commands = (settings.hooks['PreToolUse'] as Array<{ command: string }>).map((h) => h.command);
    expect(commands).toContain('./hook-a.sh');
    expect(commands).toContain('./hook-b.sh');
  });

  it('다른 event의 hook 2개 → 각각 독립 이벤트 키', () => {
    const modules = [
      makeModule({
        name: 'hook-pre',
        type: 'hook',
        body: { event: 'PreToolUse', hooks: [{ type: 'command', command: './pre.sh' }] },
      }),
      makeModule({
        name: 'hook-session',
        type: 'hook',
        body: { event: 'SessionStart', hooks: [{ type: 'command', command: './session.sh' }] },
      }),
    ];
    const result = merge(modules, []);
    const settings = result.settingsJson as { hooks: Record<string, unknown[]> };
    expect(settings.hooks['PreToolUse']).toBeDefined();
    expect(settings.hooks['SessionStart']).toBeDefined();
  });

  it('auto-build hook 자동 삽입 확인 (PostToolUse에 harness-kit 관련 hook 존재)', () => {
    const result = merge([], []);
    const settings = result.settingsJson as { hooks: Record<string, Array<{ command: string; matcher?: string }>> };
    const postToolUseHooks = settings.hooks['PostToolUse'];
    expect(postToolUseHooks).toBeDefined();
    expect(postToolUseHooks.length).toBeGreaterThan(0);
    const harnessHook = postToolUseHooks.find((h) => h.command.includes('harness-kit'));
    expect(harnessHook).toBeDefined();
    expect(harnessHook?.matcher).toContain('Write');
  });
});

// ---- MCP merging ----

describe('mergeMcp', () => {
  it('서로 다른 MCP 서버 2개 → 정상 병합', () => {
    const modules = [
      makeModule({
        name: 'mcp-serena',
        type: 'mcp',
        body: { command: 'npx', args: ['serena-mcp@latest'] },
      }),
      makeModule({
        name: 'mcp-postgres',
        type: 'mcp',
        body: { command: 'node', args: ['./pg-mcp.js'] },
      }),
    ];
    const result = merge(modules, []);
    const settings = result.settingsJson as { mcpServers: Record<string, { command: string; args: string[] }> };
    expect(settings.mcpServers['mcp-serena']).toBeDefined();
    expect(settings.mcpServers['mcp-postgres']).toBeDefined();
    expect(settings.mcpServers['mcp-serena'].command).toBe('npx');
    expect(settings.mcpServers['mcp-postgres'].command).toBe('node');
  });

  it('같은 키 + 같은 값 → idempotent (에러 없음)', () => {
    const modules = [
      makeModule({
        name: 'mcp-serena',
        type: 'mcp',
        body: { command: 'npx', args: ['serena-mcp@latest'] },
      }),
      makeModule({
        name: 'mcp-serena',
        type: 'mcp',
        body: { command: 'npx', args: ['serena-mcp@latest'] },
      }),
    ];
    expect(() => merge(modules, [])).not.toThrow();
    const result = merge(modules, []);
    const settings = result.settingsJson as { mcpServers: Record<string, unknown> };
    expect(Object.keys(settings.mcpServers)).toHaveLength(1);
  });

  it('같은 키 + 다른 값 → DuplicateMcpKeyError throw', () => {
    const modules = [
      makeModule({
        name: 'mcp-serena',
        type: 'mcp',
        body: { command: 'npx', args: ['serena-mcp@latest'] },
      }),
      makeModule({
        name: 'mcp-serena',
        type: 'mcp',
        body: { command: 'node', args: ['./different.js'] },
      }),
    ];
    expect(() => merge(modules, [])).toThrow(DuplicateMcpKeyError);
  });
});

// ---- Permission merging ----

describe('mergePermissions', () => {
  it('allow + deny 합집합', () => {
    const modules = [
      makeModule({
        name: 'perm-a',
        type: 'permission',
        body: { allow: ['Bash', 'Read'], deny: [] },
      }),
      makeModule({
        name: 'perm-b',
        type: 'permission',
        body: { allow: ['Write'], deny: ['Edit'] },
      }),
    ];
    const result = merge(modules, []);
    const settings = result.settingsLocalJson as { permissions: { allow: string[]; deny: string[] } };
    expect(settings.permissions.allow).toContain('Bash');
    expect(settings.permissions.allow).toContain('Read');
    expect(settings.permissions.allow).toContain('Write');
    expect(settings.permissions.deny).toContain('Edit');
  });

  it('allow와 deny에 같은 패턴 → deny 우선 (allow에서 제거)', () => {
    const modules = [
      makeModule({
        name: 'perm-conflict',
        type: 'permission',
        body: { allow: ['Bash', 'Write'], deny: ['Bash'] },
      }),
    ];
    const result = merge(modules, []);
    const settings = result.settingsLocalJson as { permissions: { allow: string[]; deny: string[] } };
    // Bash is in deny, so it should be removed from allow
    expect(settings.permissions.deny).toContain('Bash');
    expect(settings.permissions.allow).not.toContain('Bash');
    // Write is only in allow, should remain
    expect(settings.permissions.allow).toContain('Write');
  });
});

// ---- Agent file-per ----

describe('agent modules', () => {
  it('agent 모듈 2개 → agentFiles Map에 2개 entry', () => {
    const modules = [
      makeModule({ name: 'agent-alpha', type: 'agent', body: '# Agent Alpha\nDoes alpha tasks.' }),
      makeModule({ name: 'agent-beta', type: 'agent', body: '# Agent Beta\nDoes beta tasks.' }),
    ];
    const result = merge(modules, []);
    expect(result.agentFiles.size).toBe(2);
    expect(result.agentFiles.has('agent-alpha')).toBe(true);
    expect(result.agentFiles.has('agent-beta')).toBe(true);
    expect(result.agentFiles.get('agent-alpha')).toContain('Agent Alpha');
    expect(result.agentFiles.get('agent-beta')).toContain('Agent Beta');
  });
});

// ---- Custom blocks ----

describe('appendCustomBlocks', () => {
  it("position: 'prepend' → base 앞에 삽입", () => {
    const modules = [
      makeModule({ name: 'mod-a', type: 'instruction', body: 'base content', frontmatterExtra: { section: '## Base' } }),
    ];
    const custom = [
      { id: 'prepend-block', section: '## Prepended', content: 'prepended content', position: 'prepend' as const },
    ];
    const result = merge(modules, custom);
    const posPrepended = result.claudeMd.indexOf('prepended content');
    const posBase = result.claudeMd.indexOf('base content');
    expect(posPrepended).toBeGreaterThanOrEqual(0);
    expect(posBase).toBeGreaterThanOrEqual(0);
    expect(posPrepended).toBeLessThan(posBase);
  });

  it("position: 'append' (기본) → base 뒤에 삽입", () => {
    const modules = [
      makeModule({ name: 'mod-a', type: 'instruction', body: 'base content', frontmatterExtra: { section: '## Base' } }),
    ];
    const custom = [
      { id: 'append-block', section: '## Appended', content: 'appended content', position: 'append' as const },
    ];
    const result = merge(modules, custom);
    const posBase = result.claudeMd.indexOf('base content');
    const posAppended = result.claudeMd.indexOf('appended content');
    expect(posBase).toBeGreaterThanOrEqual(0);
    expect(posAppended).toBeGreaterThanOrEqual(0);
    expect(posBase).toBeLessThan(posAppended);
  });

  it('복수 custom 블록 → 순서대로', () => {
    const modules: ValidatedModule[] = [];
    const custom = [
      { id: 'block-1', content: 'first custom', position: 'append' as const },
      { id: 'block-2', content: 'second custom', position: 'append' as const },
    ];
    const result = merge(modules, custom);
    const pos1 = result.claudeMd.indexOf('first custom');
    const pos2 = result.claudeMd.indexOf('second custom');
    expect(pos1).toBeGreaterThanOrEqual(0);
    expect(pos2).toBeGreaterThanOrEqual(0);
    expect(pos1).toBeLessThan(pos2);
  });
});

// ---- Per-module vars rendering ----

describe('per-module vars in instructions', () => {
  it('instruction 모듈에 vars → body 내 {{var}} 치환됨', () => {
    const modules = [
      makeModule({
        name: 'mod-vars',
        type: 'instruction',
        body: 'Memory limit: {{memLimit}}',
        vars: { memLimit: '512m' },
      }),
    ];
    const result = merge(modules, []);
    expect(result.claudeMd).toContain('Memory limit: 512m');
    expect(result.claudeMd).not.toContain('{{memLimit}}');
  });
});
