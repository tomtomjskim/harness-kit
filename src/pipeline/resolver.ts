import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import type { ConfigModuleEntrySchema } from '../types/index.js';
import type { z } from 'zod';
import type { WhenConditionSchema } from '../types/index.js';
import { ModuleNotFoundError } from '../errors.js';

export type ConfigModuleEntry = z.infer<typeof ConfigModuleEntrySchema>;
export type WhenCondition = z.infer<typeof WhenConditionSchema>;

export interface ResolvedModule {
  name: string;
  path: string;
  vars?: Record<string, unknown>;
  when?: WhenCondition;
}

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Patterns to try for a given module name (flat + subdirectory scan)
function candidatePaths(dir: string, name: string): string[] {
  const paths = [
    join(dir, `${name}.md`),
    join(dir, `${name}.yaml`),
    join(dir, name, 'index.md'),
    join(dir, name, 'index.yaml'),
  ];
  // Also search in type-based subdirectories (instructions/, hooks/, mcp/, agents/, workflows/, skills/, presets/, permissions/)
  const subDirs = ['instructions', 'hooks', 'mcp', 'agents', 'workflows', 'skills', 'presets', 'permissions'];
  for (const sub of subDirs) {
    paths.push(join(dir, sub, `${name}.md`));
    paths.push(join(dir, sub, `${name}.yaml`));
    paths.push(join(dir, sub, name, 'index.md'));
    paths.push(join(dir, sub, name, 'index.yaml'));
  }
  return paths;
}

// Collect all module names available in a directory for fuzzy suggestions
function collectAvailableNames(dir: string): string[] {
  try {
    const names = new Set<string>();
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.endsWith('.md')) names.add(entry.slice(0, -3));
      else if (entry.endsWith('.yaml')) names.add(entry.slice(0, -5));
      else {
        // Could be a subdirectory with index
        const subDir = join(dir, entry);
        try {
          if (statSync(subDir).isDirectory()) {
            if (
              existsSync(join(subDir, 'index.md')) ||
              existsSync(join(subDir, 'index.yaml'))
            ) {
              names.add(entry);
            }
          }
        } catch {
          // ignore
        }
      }
    }
    return Array.from(names);
  } catch {
    return [];
  }
}

export async function resolve(
  entries: ConfigModuleEntry[],
  options: { localDir?: string; globalDir?: string; verbose?: boolean },
): Promise<ResolvedModule[]> {
  const { localDir, globalDir, verbose = false } = options;
  const resolved: ResolvedModule[] = [];

  for (const entry of entries) {
    const { name, vars, when } = entry;

    let foundPath: string | null = null;
    let foundInLocal = false;

    // Search localDir first
    if (localDir) {
      for (const candidate of candidatePaths(localDir, name)) {
        if (existsSync(candidate)) {
          foundPath = candidate;
          foundInLocal = true;
          break;
        }
      }
    }

    // If not found locally, search globalDir
    if (!foundPath && globalDir) {
      for (const candidate of candidatePaths(globalDir, name)) {
        if (existsSync(candidate)) {
          foundPath = candidate;
          break;
        }
      }

      // Warn about shadowing: local has the module AND global also has it
      if (foundInLocal && verbose) {
        for (const candidate of candidatePaths(globalDir, name)) {
          if (existsSync(candidate)) {
            console.warn(
              `[harness-kit] shadowing: module "${name}" found in both local (${localDir}) and global (${globalDir}). Using local.`,
            );
            break;
          }
        }
      }
    }

    if (!foundPath) {
      // Build fuzzy suggestions from all search dirs
      const allAvailable: string[] = [];
      if (localDir) allAvailable.push(...collectAvailableNames(localDir));
      if (globalDir) allAvailable.push(...collectAvailableNames(globalDir));

      const searchedPaths: string[] = [];
      if (localDir) searchedPaths.push(candidatePaths(localDir, name)[0]);
      if (globalDir) searchedPaths.push(candidatePaths(globalDir, name)[0]);

      const unique = Array.from(new Set(allAvailable));
      const suggestions = unique
        .map((n) => ({ name: n, dist: levenshtein(name, n) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3)
        .filter((x) => x.dist <= 5)
        .map((x) => x.name);

      throw new ModuleNotFoundError(name, searchedPaths, suggestions);
    }

    resolved.push({
      name,
      path: resolvePath(foundPath),
      vars: vars as Record<string, unknown> | undefined,
      when,
    });
  }

  return resolved;
}
