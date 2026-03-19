import Mustache from 'mustache';
import type { VariableDefSchema } from '../types/index.js';
import type { z } from 'zod';
import { UndefinedVariableError } from '../errors.js';
import type { MergedOutput } from './merger.js';
import type { HarnessConfig } from '../types/index.js';

type VariableDef = z.infer<typeof VariableDefSchema>;

// Disable HTML escaping — we are generating Markdown/YAML, not HTML
Mustache.escape = (v: unknown) => String(v);

/**
 * Renders a Mustache template with the given vars.
 * - Applies defaults from variableDefs.
 * - Throws UndefinedVariableError for required variables that are missing.
 */
export function render(
  template: string,
  vars: Record<string, unknown>,
  variableDefs?: Record<string, VariableDef>,
  moduleName = '<unknown>',
): string {
  // Build the view: start with defaults, then overlay provided vars
  const view: Record<string, unknown> = {};

  if (variableDefs) {
    for (const [name, def] of Object.entries(variableDefs)) {
      if (def.default !== undefined) {
        view[name] = def.default;
      }
    }
  }

  // Overlay user-provided vars
  for (const [k, v] of Object.entries(vars)) {
    view[k] = v;
  }

  // Check required variables that have no value
  if (variableDefs) {
    for (const [name, def] of Object.entries(variableDefs)) {
      if (def.required && !(name in view)) {
        throw new UndefinedVariableError(name, moduleName);
      }
    }
  }

  // Scan template for referenced variables and check they are all present
  // Mustache.parse() returns tokens — we check for 'name' and '#' tokens
  try {
    const tokens = Mustache.parse(template);
    for (const token of tokens) {
      const tokenType = token[0];
      const tokenName = token[1] as string;
      // 'name' = {{var}}, '#' = {{#section}}, '^' = {{^inverted}}
      if ((tokenType === 'name' || tokenType === '#' || tokenType === '^') && tokenName !== '.') {
        const topLevel = tokenName.split('.')[0];
        if (topLevel && !(topLevel in view)) {
          // Only error if it's clearly a variable (not a section used as conditional with falsy default)
          if (variableDefs && topLevel in variableDefs && variableDefs[topLevel].required) {
            throw new UndefinedVariableError(topLevel, moduleName);
          }
          // For non-required / unregistered vars, Mustache renders empty string — that's acceptable
        }
      }
    }
  } catch (err) {
    if (err instanceof UndefinedVariableError) throw err;
    // Mustache parse error — let render handle it
  }

  return Mustache.render(template, view);
}

/**
 * Applies variable rendering to all string content in MergedOutput.
 */
export function renderAll(merged: MergedOutput, config: HarnessConfig): MergedOutput {
  // Global vars from config settings
  const globalVars = (config.settings ?? {}) as Record<string, unknown>;

  const renderString = (
    content: string,
    moduleVars: Record<string, unknown> = {},
    moduleName?: string,
  ): string => {
    const combinedVars = { ...globalVars, ...moduleVars };
    return render(content, combinedVars, undefined, moduleName);
  };

  // Render CLAUDE.md
  const claudeMd = renderString(merged.claudeMd, {}, 'CLAUDE.md');

  // Render agent files
  const agentFiles = new Map<string, string>();
  for (const [name, content] of merged.agentFiles) {
    agentFiles.set(name, renderString(content, {}, name));
  }

  // Render workflow files
  const workflowFiles = new Map<string, string>();
  for (const [name, content] of merged.workflowFiles) {
    workflowFiles.set(name, renderString(content, {}, name));
  }

  // Render skill files
  const skillFiles = new Map<string, { skillMd: string; attachments?: string[] }>();
  for (const [name, skill] of merged.skillFiles) {
    skillFiles.set(name, {
      skillMd: renderString(skill.skillMd, {}, name),
      attachments: skill.attachments,
    });
  }

  return {
    ...merged,
    claudeMd,
    agentFiles,
    workflowFiles,
    skillFiles,
  };
}
