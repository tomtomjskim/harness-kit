import { readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { BaseModule } from '../types/index.js';
import type { ResolvedModule } from './resolver.js';

export interface LoadedModule {
  name: string;
  /** Zod 검증 전 raw frontmatter */
  frontmatter: Record<string, unknown>;
  /** instruction/agent/skill → string, hook/mcp/workflow/permission → parsed yaml object */
  body: string | object;
  rawContent: string;
  filePath: string;
  vars?: Record<string, unknown>;
  when?: ResolvedModule['when'];
}

// Types whose body should be kept as a markdown string
const STRING_BODY_TYPES = new Set(['instruction', 'agent', 'skill', 'preset']);

export async function load(resolved: ResolvedModule[]): Promise<LoadedModule[]> {
  const loaded: LoadedModule[] = [];

  for (const mod of resolved) {
    let rawContent: string;
    try {
      rawContent = await readFile(mod.path, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read module file "${mod.path}": ${message}`);
    }

    const parsed = matter(rawContent);
    const frontmatter = parsed.data as Record<string, unknown>;
    const bodyText = parsed.content.trim();

    // Determine the module type from frontmatter (or from resolved entry if set)
    const moduleType = (frontmatter['type'] as string | undefined) ?? '';

    let body: string | object;
    if (STRING_BODY_TYPES.has(moduleType)) {
      body = bodyText;
    } else {
      // hook, mcp, workflow, permission — parse body as YAML
      if (bodyText) {
        try {
          const parsed2 = yaml.load(bodyText);
          body = (parsed2 && typeof parsed2 === 'object' ? parsed2 : {}) as object;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Failed to parse YAML body of module "${mod.name}" (${mod.path}): ${message}`,
          );
        }
      } else {
        body = {};
      }
    }

    loaded.push({
      name: mod.name,
      frontmatter,
      body,
      rawContent,
      filePath: mod.path,
      vars: mod.vars,
      when: mod.when,
    });
  }

  return loaded;
}
