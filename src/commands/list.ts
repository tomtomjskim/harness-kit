import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import matter from 'gray-matter';
import type { ModuleType } from '../types/index.js';

// ANSI color codes
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';

export interface ListOptions {
  search?: string;
}

interface ModuleEntry {
  name: string;
  type: ModuleType;
  description: string;
  tags: string[];
  filePath: string;
  source: 'local' | 'global';
}

const TYPE_ORDER: ModuleType[] = [
  'instruction',
  'hook',
  'mcp',
  'agent',
  'workflow',
  'skill',
  'permission',
  'preset',
];

function toModuleType(raw: unknown): ModuleType | null {
  const valid: ModuleType[] = [
    'instruction',
    'hook',
    'mcp',
    'permission',
    'agent',
    'workflow',
    'skill',
    'preset',
  ];
  if (typeof raw === 'string' && valid.includes(raw as ModuleType)) {
    return raw as ModuleType;
  }
  return null;
}

function listFilesSync(directory: string): string[] {
  const files: string[] = [];
  try {
    const items = readdirSync(directory);
    for (const item of items) {
      const fullPath = join(directory, item);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...listFilesSync(fullPath));
        } else if (item.endsWith('.md') || item.endsWith('.yaml')) {
          files.push(fullPath);
        }
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    // skip unreadable directories
  }
  return files;
}

async function scanDir(dir: string, source: 'local' | 'global'): Promise<ModuleEntry[]> {
  if (!existsSync(dir)) return [];

  const entries: ModuleEntry[] = [];
  const files = listFilesSync(dir);

  for (const filePath of files) {
    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed = matter(raw);
      const fm = parsed.data as Record<string, unknown>;

      const type = toModuleType(fm['type']);
      if (!type) continue;

      const name = typeof fm['name'] === 'string' ? fm['name'] : null;
      if (!name) continue;

      const description = typeof fm['description'] === 'string' ? fm['description'] : '';
      const tags = Array.isArray(fm['tags']) ? (fm['tags'] as string[]) : [];

      entries.push({ name, type, description, tags, filePath, source });
    } catch {
      // skip files that can't be parsed
    }
  }

  return entries;
}

function matchesSearch(entry: ModuleEntry, query: string): boolean {
  const q = query.toLowerCase();
  return (
    entry.name.toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q) ||
    entry.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export async function listCommand(
  category: string | undefined,
  options: ListOptions,
): Promise<void> {
  const globalDir =
    process.env['HARNESS_MODULE_ROOT'] ?? join(homedir(), '.harness-kit', 'modules');
  const localDir = join(process.cwd(), '.harness', 'modules');

  // Also check project-level modules/ directory (matches repo layout)
  const projectModulesDir = join(process.cwd(), 'modules');

  const [globalEntries, localEntries, projectEntries] = await Promise.all([
    scanDir(globalDir, 'global'),
    scanDir(localDir, 'local'),
    scanDir(projectModulesDir, 'local'),
  ]);

  // Deduplicate: local overrides global by name
  const allEntries = [...localEntries, ...projectEntries, ...globalEntries];
  const seen = new Set<string>();
  const deduped: ModuleEntry[] = [];
  for (const entry of allEntries) {
    if (!seen.has(entry.name)) {
      seen.add(entry.name);
      deduped.push(entry);
    }
  }

  // Apply category filter
  let filtered = deduped;
  if (category) {
    filtered = deduped.filter((e) => e.type === category);
  }

  // Apply search filter
  if (options.search) {
    filtered = filtered.filter((e) => matchesSearch(e, options.search!));
  }

  if (filtered.length === 0) {
    if (options.search) {
      console.log(`No modules found matching "${options.search}"`);
    } else if (category) {
      console.log(`No modules found in category "${category}"`);
    } else {
      console.log('No modules found.');
      console.log(`Searched: ${localDir}, ${projectModulesDir}, ${globalDir}`);
    }
    return;
  }

  // Group by type
  const grouped = new Map<ModuleType, ModuleEntry[]>();
  for (const entry of filtered) {
    if (!grouped.has(entry.type)) grouped.set(entry.type, []);
    grouped.get(entry.type)!.push(entry);
  }

  // Sort each group by name
  for (const [, group] of grouped) {
    group.sort((a, b) => a.name.localeCompare(b.name));
  }

  console.log(`\n${BOLD}Available Modules${RESET}\n`);

  let totalCount = 0;

  // Print in TYPE_ORDER
  for (const type of TYPE_ORDER) {
    const group = grouped.get(type);
    if (!group || group.length === 0) continue;

    console.log(`  ${CYAN}${type}${RESET} (${group.length})`);

    // Calculate column width for alignment
    const maxNameLen = Math.max(...group.map((e) => e.name.length));
    const colWidth = Math.max(maxNameLen + 2, 20);

    for (const entry of group) {
      const namePad = entry.name.padEnd(colWidth);
      const desc = entry.description || GRAY + '(no description)' + RESET;
      console.log(`    ${namePad}${desc}`);
    }

    console.log('');
    totalCount += group.length;
  }

  console.log(`Total: ${totalCount} modules`);
  console.log('');
}
