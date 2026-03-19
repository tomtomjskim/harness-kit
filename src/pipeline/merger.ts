import type { CustomBlockSchema, HookBodySchema, McpBodySchema } from '../types/index.js';
import type { z } from 'zod';
import type { ValidatedModule } from './validator.js';
import { DuplicateMcpKeyError } from '../errors.js';
import { render } from './renderer.js';

type CustomBlock = z.infer<typeof CustomBlockSchema>;
type HookBody = z.infer<typeof HookBodySchema>;
type McpBody = z.infer<typeof McpBodySchema>;

export interface MergedOutput {
  claudeMd: string;
  settingsJson: object;
  settingsLocalJson: object;
  agentFiles: Map<string, string>;
  workflowFiles: Map<string, string>;
  skillFiles: Map<string, { skillMd: string; attachments?: string[] }>;
}

// ---- Instruction merging ----

interface InstructionGroup {
  section: string;
  modules: ValidatedModule[];
}

function mergeInstructions(modules: ValidatedModule[]): string {
  const groups = new Map<string, ValidatedModule[]>();
  const sectionOrder: string[] = [];

  for (const mod of modules) {
    const raw = mod.frontmatter as Record<string, unknown>;
    const section = (raw['section'] as string | undefined) ?? '## General';
    if (!groups.has(section)) {
      groups.set(section, []);
      sectionOrder.push(section);
    }
    groups.get(section)!.push(mod);
  }

  const parts: string[] = [];
  for (const section of sectionOrder) {
    parts.push(section);
    for (const mod of groups.get(section)!) {
      let body = mod.body as string;
      // Apply per-module vars before merging
      if (mod.vars && Object.keys(mod.vars).length > 0) {
        const variableDefs = (mod.frontmatter as Record<string, unknown>)['variables'] as Record<string, { type?: string; required?: boolean; default?: unknown }> | undefined;
        body = render(body, mod.vars, variableDefs as never, mod.name);
      }
      parts.push(body);
    }
  }

  return parts.join('\n\n').trim();
}

// ---- Hook merging ----

interface HookSettings {
  hooks: Record<string, Array<{ type: string; command: string; timeout?: number; async?: boolean; matcher?: string }>>;
}

function mergeHooks(modules: ValidatedModule[]): HookSettings {
  const hooks: HookSettings['hooks'] = {};

  for (const mod of modules) {
    const body = mod.body as HookBody;
    const event = body.event;
    if (!hooks[event]) hooks[event] = [];

    for (const handler of body.hooks) {
      // Render per-module vars in hook commands
      let command = handler.command;
      if (mod.vars && Object.keys(mod.vars).length > 0) {
        command = render(command, mod.vars, undefined, mod.name);
      }
      const entry: HookSettings['hooks'][string][number] = {
        type: handler.type,
        command,
      };
      if (handler.timeout !== undefined) entry.timeout = handler.timeout;
      if (handler.async !== undefined) entry.async = handler.async;
      if (body.matcher !== undefined) entry.matcher = body.matcher;
      hooks[event].push(entry);
    }
  }

  return { hooks };
}

// ---- MCP merging ----

interface McpSettings {
  mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
}

function mergeMcp(modules: ValidatedModule[]): McpSettings {
  const mcpServers: McpSettings['mcpServers'] = {};

  for (const mod of modules) {
    const body = mod.body as McpBody;
    const serverName = mod.name;

    if (mcpServers[serverName]) {
      const existing = mcpServers[serverName];
      // Check if values are identical (idempotent) or conflicting
      const sameCommand = existing.command === body.command;
      const sameArgs = JSON.stringify(existing.args) === JSON.stringify(body.args ?? []);
      const sameEnv = JSON.stringify(existing.env ?? {}) === JSON.stringify(body.env ?? {});

      if (!sameCommand || !sameArgs || !sameEnv) {
        // Find the first module that set this key
        const firstModuleName = Object.entries(mcpServers).find(
          ([k]) => k === serverName,
        )?.[0] ?? serverName;
        throw new DuplicateMcpKeyError(serverName, firstModuleName, mod.name);
      }
      // Identical — idempotent, skip
      continue;
    }

    const entry: McpSettings['mcpServers'][string] = {
      command: body.command,
      args: body.args ?? [],
    };
    if (body.env) entry.env = body.env;
    mcpServers[serverName] = entry;
  }

  return { mcpServers };
}

// ---- Permission merging ----

interface PermissionSettings {
  permissions: {
    allow: string[];
    deny: string[];
  };
}

interface PermissionBody {
  allow?: string[];
  deny?: string[];
}

function mergePermissions(modules: ValidatedModule[]): PermissionSettings {
  const allowSet = new Set<string>();
  const denySet = new Set<string>();

  for (const mod of modules) {
    const body = mod.body as PermissionBody;
    for (const p of body.allow ?? []) allowSet.add(p);
    for (const p of body.deny ?? []) denySet.add(p);
  }

  // deny takes precedence — remove from allow anything that's in deny
  for (const d of denySet) allowSet.delete(d);

  return {
    permissions: {
      allow: Array.from(allowSet),
      deny: Array.from(denySet),
    },
  };
}

// ---- Custom block appending ----

function appendCustomBlocks(base: string, custom: CustomBlock[]): string {
  if (custom.length === 0) return base;

  const prepend: string[] = [];
  const append: string[] = [];

  for (const block of custom) {
    const parts: string[] = [];
    if (block.section) parts.push(block.section);
    parts.push(block.content);
    const combined = parts.join('\n\n');

    if ((block as { position?: string }).position === 'prepend') {
      prepend.push(combined);
    } else {
      append.push(combined);
    }
  }

  return [...prepend, base, ...append].join('\n\n').trim();
}

// ---- Main merge ----

export function merge(modules: ValidatedModule[], custom: CustomBlock[]): MergedOutput {
  const instructions = modules.filter((m) => m.frontmatter.type === 'instruction');
  const hooks = modules.filter((m) => m.frontmatter.type === 'hook');
  const mcps = modules.filter((m) => m.frontmatter.type === 'mcp');
  const permissions = modules.filter((m) => m.frontmatter.type === 'permission');
  const agents = modules.filter((m) => m.frontmatter.type === 'agent');
  const workflows = modules.filter((m) => m.frontmatter.type === 'workflow');
  const skills = modules.filter((m) => m.frontmatter.type === 'skill');

  // CLAUDE.md: instructions merged, then custom blocks
  const instructionContent = mergeInstructions(instructions);
  const claudeMd = appendCustomBlocks(instructionContent, custom);

  // settings.json: hooks + mcp merged
  const hookSettings = mergeHooks(hooks);
  const mcpSettings = mergeMcp(mcps);

  // Built-in hook: auto-rebuild when harness.config.yaml is modified
  if (!hookSettings.hooks['PostToolUse']) hookSettings.hooks['PostToolUse'] = [];
  hookSettings.hooks['PostToolUse'].push({
    type: 'command',
    command: 'bash -c \'FILE=$(cat | jq -r ".tool_input.file_path // empty"); if [ "$FILE" = "harness.config.yaml" ]; then echo "[harness-kit] config changed, rebuilding..." >&2; harness-kit build 2>/dev/null || true; fi\'',
    async: true,
    matcher: 'Write|Edit',
  });

  const settingsJson = {
    ...hookSettings,
    ...mcpSettings,
  };

  // settings.local.json: permissions
  const settingsLocalJson = mergePermissions(permissions);

  // Agent files: one per module
  const agentFiles = new Map<string, string>();
  for (const mod of agents) {
    agentFiles.set(mod.name, mod.body as string);
  }

  // Workflow files: one per module
  const workflowFiles = new Map<string, string>();
  for (const mod of workflows) {
    workflowFiles.set(mod.name, mod.body as string);
  }

  // Skill files: one per module + optional attachments (stored in body for now)
  const skillFiles = new Map<string, { skillMd: string; attachments?: string[] }>();
  for (const mod of skills) {
    skillFiles.set(mod.name, { skillMd: mod.body as string });
  }

  return {
    claudeMd,
    settingsJson,
    settingsLocalJson,
    agentFiles,
    workflowFiles,
    skillFiles,
  };
}
