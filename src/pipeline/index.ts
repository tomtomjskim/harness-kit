import { resolve } from './resolver.js';
import { load } from './loader.js';
import { validate } from './validator.js';
import { merge } from './merger.js';
import { renderAll } from './renderer.js';
import { write } from './writer.js';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HarnessConfig } from '../types/index.js';
import type { BuildOptions } from '../commands/build.js';
import type { WhenCondition } from './resolver.js';

export { resolve } from './resolver.js';
export { load } from './loader.js';
export { validate } from './validator.js';
export { merge } from './merger.js';
export { render, renderAll } from './renderer.js';
export { write } from './writer.js';

async function evaluateWhen(when: WhenCondition, cwd: string): Promise<boolean> {
  if (!when) return true;

  if (when.file_exists) {
    if (!existsSync(join(cwd, when.file_exists))) return false;
  }

  if (when.package_has) {
    try {
      const pkgPath = join(cwd, 'package.json');
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };
      if (!allDeps[when.package_has]) return false;
    } catch {
      return false; // no package.json = condition not met
    }
  }

  if (when.env_set) {
    if (!process.env[when.env_set]) return false;
  }

  return true;
}

export async function runPipeline(config: HarnessConfig, options: BuildOptions): Promise<void> {
  const {
    verbose = false,
    dryRun = false,
    outputDir = '.',
    localDir,
    globalDir,
  } = options as BuildOptions & { localDir?: string; globalDir?: string };

  const configHash = createHash('sha256')
    .update(JSON.stringify(config))
    .digest('hex');

  if (verbose) console.log('[1/6] Resolving modules...');
  const resolved = await resolve(config.modules, {
    localDir: localDir ?? '.harness/modules',
    globalDir: globalDir ?? (process.env['HOME'] ? `${process.env['HOME']}/.harness-kit/modules` : undefined),
    verbose,
  });

  if (verbose) {
    for (const r of resolved) {
      console.log(`  resolved: ${r.name} → ${r.path}`);
    }
  }

  // Evaluate when conditions and filter out modules that don't pass
  const cwd = process.cwd();
  const filtered = [];
  for (const mod of resolved) {
    if (mod.when) {
      const pass = await evaluateWhen(mod.when, cwd);
      if (!pass) {
        if (verbose) console.log(`  skipped: ${mod.name} (when condition not met)`);
        continue;
      }
    }
    filtered.push(mod);
  }

  if (verbose) console.log('[2/6] Loading module files...');
  const loaded = await load(filtered);

  if (verbose) console.log('[3/6] Validating modules...');
  const validated = validate(loaded);

  if (verbose) console.log('[4/6] Merging modules...');
  const merged = merge(validated, config.custom ?? []);

  if (verbose) console.log('[5/6] Rendering variables...');
  const rendered = renderAll(merged, config);

  if (verbose) console.log('[6/6] Writing output files...');
  const result = await write(rendered, { outputDir, dryRun, configHash });

  if (dryRun) {
    console.log('\n[dry-run] Files that would be written:');
    for (const f of result.files) {
      console.log(`  ${f.path} (${f.size} bytes)`);
    }
  } else {
    console.log('\nBuild complete. Files written:');
    for (const f of result.files) {
      console.log(`  ${f.path} (${f.size} bytes)`);
    }
    console.log(`\nManifest: ${result.manifestPath}`);
  }
}
