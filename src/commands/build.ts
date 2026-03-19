import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import yaml from 'js-yaml';
import { HarnessConfigSchema } from '../types/index.js';
import type { HarnessConfig } from '../types/index.js';
import { runPipeline } from '../pipeline/index.js';
import { HarnessError } from '../errors.js';

export interface BuildOptions {
  verbose?: boolean;
  dryRun?: boolean;
  outputDir?: string;
  /** Override local modules directory (default: .harness/modules) */
  localDir?: string;
  /** Override global modules directory (default: ~/.harness-kit/modules) */
  globalDir?: string;
  /** Build profile name (merges profile modules with base modules) */
  profile?: string;
}

/**
 * Build Claude Code configuration from a HarnessConfig object.
 * The config is assumed to have already been parsed and validated.
 */
export async function build(config: HarnessConfig, options: BuildOptions = {}): Promise<void> {
  const resolvedOptions: BuildOptions = {
    verbose: options.verbose ?? false,
    dryRun: options.dryRun ?? false,
    outputDir: options.outputDir ?? '.',
    localDir: options.localDir,
    globalDir: options.globalDir,
  };

  try {
    await runPipeline(config, resolvedOptions);
  } catch (err) {
    if (err instanceof HarnessError) {
      console.error(`[harness-kit] Error (${err.code}): ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

/**
 * Entry point called from the CLI.
 * Reads harness.config.yaml from the current directory (or specified path),
 * validates it, then runs the build pipeline.
 */
export async function buildFromFile(
  configPath: string,
  options: BuildOptions = {},
): Promise<void> {
  const absConfigPath = resolve(configPath);

  let rawContent: string;
  try {
    rawContent = await readFile(absConfigPath, 'utf-8');
  } catch {
    console.error(`[harness-kit] Cannot read config file: ${absConfigPath}`);
    process.exit(1);
  }

  let rawConfig: unknown;
  try {
    rawConfig = yaml.load(rawContent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[harness-kit] Failed to parse YAML config: ${msg}`);
    process.exit(1);
  }

  const parseResult = HarnessConfigSchema.safeParse(rawConfig);
  if (!parseResult.success) {
    console.error('[harness-kit] Config validation failed:');
    for (const issue of parseResult.error.issues) {
      console.error(`  - [${issue.path.join('.')}] ${issue.message}`);
    }
    process.exit(1);
  }

  const config = parseResult.data;

  // Apply profile: merge profile modules into base modules
  if (options.profile) {
    const profileName = options.profile;
    const profiles = config.profiles ?? {};
    if (!(profileName in profiles)) {
      const available = Object.keys(profiles);
      console.error(`[harness-kit] Profile "${profileName}" not found.`);
      if (available.length > 0) {
        console.error(`  Available profiles: ${available.join(', ')}`);
      } else {
        console.error('  No profiles defined in harness.config.yaml.');
        console.error('  Add a "profiles:" section to your config.');
      }
      process.exit(1);
    }
    const profile = profiles[profileName];
    if (profile.modules && profile.modules.length > 0) {
      // Append profile modules to base modules
      config.modules = [...config.modules, ...profile.modules];
      if (options.verbose) {
        console.log(`[profile:${profileName}] Added ${profile.modules.length} modules: ${profile.modules.map(m => m.name).join(', ')}`);
      }
    }
  }

  // Apply HARNESS_MODULE_ROOT env var as globalDir default
  const finalOptions: BuildOptions = {
    ...options,
    globalDir: options.globalDir ?? process.env['HARNESS_MODULE_ROOT'] ?? join(homedir(), '.harness-kit', 'modules'),
    localDir: options.localDir ?? resolve('.harness', 'modules'),
  };

  await build(config, finalOptions);
}
