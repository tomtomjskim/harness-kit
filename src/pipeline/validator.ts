import {
  BaseModuleSchema,
  HookBodySchema,
  McpBodySchema,
} from '../types/index.js';
import type { BaseModule } from '../types/index.js';
import type { LoadedModule } from './loader.js';
import {
  ValidationError,
  CyclicDependencyError,
} from '../errors.js';

export interface ValidatedModule {
  name: string;
  frontmatter: BaseModule;
  body: string | object;
  rawContent: string;
  filePath: string;
  vars?: Record<string, unknown>;
  when?: LoadedModule['when'];
}

/**
 * Kahn's algorithm — topological sort for dependency cycle detection.
 * Returns true if a cycle exists.
 */
function detectCycle(modules: ValidatedModule[]): string[] | null {
  const nameSet = new Set(modules.map((m) => m.name));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const mod of modules) {
    inDegree.set(mod.name, inDegree.get(mod.name) ?? 0);
    adj.set(mod.name, []);
  }

  for (const mod of modules) {
    for (const dep of mod.frontmatter.dependencies) {
      if (!nameSet.has(dep)) continue; // external dep, skip
      adj.get(dep)!.push(mod.name);
      inDegree.set(mod.name, (inDegree.get(mod.name) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  let processed = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    processed++;
    for (const neighbor of adj.get(node) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (processed < modules.length) {
    // Find the cycle participants (nodes with remaining in-degree > 0)
    const cycleNodes = Array.from(inDegree.entries())
      .filter(([, deg]) => deg > 0)
      .map(([name]) => name);
    return cycleNodes;
  }
  return null;
}

export function validate(modules: LoadedModule[]): ValidatedModule[] {
  // 1. Detect duplicate module names
  const nameCount = new Map<string, number>();
  for (const mod of modules) {
    const key = (mod.frontmatter['name'] as string | undefined) ?? mod.name;
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }
  for (const [name, count] of nameCount) {
    if (count > 1) {
      throw new Error(`Duplicate module name detected: "${name}" appears ${count} times.`);
    }
  }

  const validated: ValidatedModule[] = [];

  for (const mod of modules) {
    // 2. Validate frontmatter with BaseModuleSchema
    const fmResult = BaseModuleSchema.safeParse({
      ...mod.frontmatter,
      // Use the resolved name as fallback if frontmatter omits it
      name: mod.frontmatter['name'] ?? mod.name,
    });

    if (!fmResult.success) {
      throw new ValidationError(mod.name, fmResult.error.issues);
    }

    const frontmatter = fmResult.data;

    // 3. Type-specific body validation
    if (frontmatter.type === 'hook') {
      const hookResult = HookBodySchema.safeParse(mod.body);
      if (!hookResult.success) {
        throw new ValidationError(mod.name, hookResult.error.issues);
      }
    }

    if (frontmatter.type === 'mcp') {
      const mcpResult = McpBodySchema.safeParse(mod.body);
      if (!mcpResult.success) {
        throw new ValidationError(mod.name, mcpResult.error.issues);
      }
    }

    // 4. Check required variables are present in vars
    if (frontmatter.variables) {
      for (const [varName, varDef] of Object.entries(frontmatter.variables)) {
        if (varDef.required && varDef.default === undefined) {
          const provided = mod.vars ?? {};
          if (!(varName in provided)) {
            throw new Error(
              `Module "${mod.name}": required variable "${varName}" is not provided. ` +
                `Add it to the module entry's "vars" section in harness.config.yaml.`,
            );
          }
        }
      }
    }

    validated.push({
      name: mod.name,
      frontmatter,
      body: mod.body,
      rawContent: mod.rawContent,
      filePath: mod.filePath,
      vars: mod.vars,
      when: mod.when,
    });
  }

  // 5. Cycle detection across all validated modules
  const cycle = detectCycle(validated);
  if (cycle) {
    throw new CyclicDependencyError(cycle);
  }

  return validated;
}
