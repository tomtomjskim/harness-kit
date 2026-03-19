import { existsSync, readdirSync, statSync } from 'node:fs';
import { copyFile, mkdir, symlink, rm } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export interface InstallModulesOptions {
  link?: boolean;
  force?: boolean;
}

/**
 * Recursively collect all .md and .yaml files under a directory.
 * Returns paths relative to the given baseDir.
 */
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          const nested = collectFiles(fullPath);
          for (const f of nested) {
            results.push(join(entry, f));
          }
        } else if (entry.endsWith('.md') || entry.endsWith('.yaml')) {
          results.push(entry);
        }
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    // skip unreadable directories
  }
  return results;
}

/**
 * Resolve the built-in modules/ directory bundled with harness-kit.
 * tsup bundles all commands as chunks directly under dist/, so
 * import.meta.url resolves to dist/<chunk>.js — one level up reaches
 * the package root where modules/ lives.
 */
function resolveBuiltinModulesDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // dist/<chunk>.js → dist/ → package root
  const pkgRoot = join(dirname(thisFile), '..');
  return join(pkgRoot, 'modules');
}

export async function installModulesCommand(options: InstallModulesOptions): Promise<void> {
  console.log('\nharness-kit install-modules\n');

  const builtinDir = resolveBuiltinModulesDir();

  if (!existsSync(builtinDir)) {
    process.stderr.write(`Error: Built-in modules directory not found: ${builtinDir}\n`);
    process.stderr.write(`Make sure harness-kit is properly built (npm run build).\n`);
    process.exit(1);
  }

  const targetDir = process.env['HARNESS_MODULE_ROOT'] ?? join(homedir(), '.harness-kit', 'modules');
  console.log(`Installing modules to ${targetDir.replace(homedir(), '~')}/\n`);

  // Collect all module files from builtin dir
  const files = collectFiles(builtinDir);

  if (files.length === 0) {
    console.log('No modules found in built-in modules directory.');
    return;
  }

  let installedCount = 0;
  let skippedCount = 0;

  for (const relPath of files) {
    const srcPath = join(builtinDir, relPath);
    const destPath = join(targetDir, relPath);
    const destDirPath = dirname(destPath);

    // Ensure destination subdirectory exists
    await mkdir(destDirPath, { recursive: true });

    const displayPath = relPath.replace(/\\/g, '/');

    if (existsSync(destPath) && !options.force) {
      console.log(`  ${YELLOW}[skipped]${RESET} ${displayPath} (already exists, use --force to overwrite)`);
      skippedCount++;
      continue;
    }

    if (options.link) {
      // Create symlink: compute relative path from dest to src
      const relSrcPath = relative(destDirPath, srcPath);
      // Remove existing symlink or file before creating new one
      if (existsSync(destPath)) {
        await rm(destPath, { force: true });
      }
      await symlink(relSrcPath, destPath);
      console.log(`  ${GREEN}[linked]${RESET}  ${displayPath}`);
    } else {
      await copyFile(srcPath, destPath);
      console.log(`  ${GREEN}[copied]${RESET}  ${displayPath}`);
    }

    installedCount++;
  }

  console.log('');

  const action = options.link ? 'linked' : 'Installed';
  const total = installedCount + skippedCount;

  if (installedCount > 0) {
    console.log(
      `${action.charAt(0).toUpperCase() + action.slice(1)} ${installedCount} of ${total} modules to ${targetDir.replace(homedir(), '~')}/`,
    );
  } else {
    console.log(`No new modules installed (${skippedCount} already exist, use --force to overwrite).`);
  }
  console.log('');
}
