import { z } from 'zod';

// Module Types
export const ModuleTypeEnum = z.enum([
  'instruction', 'hook', 'mcp', 'permission',
  'agent', 'workflow', 'skill', 'preset',
]);
export type ModuleType = z.infer<typeof ModuleTypeEnum>;

// Variable Definition
export const VariableDefSchema = z.object({
  type: z.enum(['string', 'number', 'boolean']).default('string'),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  description: z.string().optional(),
});

// Base Module (frontmatter)
export const BaseModuleSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/, 'kebab-case only'),
  type: ModuleTypeEnum,
  description: z.string().min(1),
  tags: z.array(z.string()).default([]),
  priority: z.number().int().min(0).max(999).default(50),
  dependencies: z.array(z.string()).default([]),
  variables: z.record(z.string(), VariableDefSchema).optional(),
  source: z.string().optional(), // reserved for v1
  section: z.string().optional(), // CLAUDE.md section heading for this module
});
export type BaseModule = z.infer<typeof BaseModuleSchema>;

// Instruction Module
export const InstructionModuleSchema = BaseModuleSchema.extend({
  type: z.literal('instruction'),
  section: z.string().optional(),
});

// Hook Module Body
export const HookBodySchema = z.object({
  event: z.enum([
    'PreToolUse', 'PostToolUse', 'UserPromptSubmit',
    'Stop', 'SessionStart', 'Notification',
    'SubagentStop', 'PreCompact',
  ]),
  matcher: z.string().optional(),
  hooks: z.array(z.object({
    type: z.literal('command'),
    command: z.string(),
    timeout: z.number().optional(),
    async: z.boolean().optional(),
  })).min(1),
});

// MCP Module Body
export const McpBodySchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
});

// Agent Module
export const AgentModuleSchema = BaseModuleSchema.extend({
  type: z.literal('agent'),
  model: z.enum(['sonnet', 'haiku', 'opus', 'inherit']).default('sonnet'),
  tools: z.array(z.string()).default([]),
});

// Custom Block
export const CustomBlockSchema = z.object({
  id: z.string().min(1),
  section: z.string().optional(),
  content: z.string(),
  position: z.enum(['prepend', 'append']).default('append'),
});

// Module When Condition
export const WhenConditionSchema = z.object({
  file_exists: z.string().optional(),
  package_has: z.string().optional(),
  env_set: z.string().optional(),
}).optional();

// Config Module Entry
export const ConfigModuleEntrySchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Module name must be kebab-case (a-z, 0-9, hyphens only)'),
  type: ModuleTypeEnum.optional(),
  source: z.string().optional(),
  vars: z.record(z.string(), z.unknown()).optional(),
  when: WhenConditionSchema,
});

// Profile
export const ProfileSchema = z.object({
  modules: z.array(ConfigModuleEntrySchema).default([]),
});

// Main Config (harness.config.yaml)
export const HarnessConfigSchema = z.object({
  version: z.literal('1'),
  name: z.string().optional(),
  preset: z.string().optional(),
  modules: z.array(ConfigModuleEntrySchema),
  settings: z.record(z.string(), z.unknown()).optional(),
  custom: z.array(CustomBlockSchema).default([]),
  profiles: z.record(z.string(), ProfileSchema).optional(),
});
export type HarnessConfig = z.infer<typeof HarnessConfigSchema>;

// Build Manifest
export const BuildManifestSchema = z.object({
  version: z.literal('1'),
  built_at: z.string(),
  config_hash: z.string(),
  modules: z.array(z.object({
    name: z.string(),
    path: z.string(),
    hash: z.string(),
  })),
  output_hash: z.string(),
});
export type BuildManifest = z.infer<typeof BuildManifestSchema>;

// Re-export Module as alias for BaseModule (used in index.ts public API)
export type Module = BaseModule;
