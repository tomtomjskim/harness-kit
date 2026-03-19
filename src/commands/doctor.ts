import { existsSync, statSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import yaml from 'js-yaml';
import { HarnessConfigSchema } from '../types/index.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function ok(msg: string): string {
  return `  ${GREEN}✓${RESET} ${msg}`;
}

function fail(msg: string): string {
  return `  ${RED}✗${RESET} ${msg}`;
}

function warn(msg: string): string {
  return `  ${YELLOW}⚠${RESET} ${msg}`;
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(Number);
}

function gte(actual: number[], required: number[]): boolean {
  for (let i = 0; i < required.length; i++) {
    const a = actual[i] ?? 0;
    const r = required[i] ?? 0;
    if (a > r) return true;
    if (a < r) return false;
  }
  return true;
}

function countModulesInDir(dir: string): number {
  try {
    const entries = readdirSync(dir);
    let count = 0;
    for (const entry of entries) {
      if (entry.endsWith('.md') || entry.endsWith('.yaml')) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

export async function doctorCommand(): Promise<void> {
  console.log('\nharness-kit doctor\n');

  const issues: string[] = [];
  const suggestions: string[] = [];

  // 1. Node.js version check
  const nodeVersion = process.version;
  const parsedVersion = parseVersion(nodeVersion);
  const meetsNode = gte(parsedVersion, [18, 0, 0]);
  if (meetsNode) {
    console.log(ok(`Node.js ${nodeVersion} (>=18 required)`));
  } else {
    console.log(fail(`Node.js ${nodeVersion} — requires >=18`));
    issues.push('Node.js version too old');
    suggestions.push('Upgrade Node.js to v18 or later');
  }

  // 2. harness-kit version
  let pkgVersion = '0.1.0';
  try {
    const possiblePaths = [
      join(new URL(import.meta.url).pathname, '..', '..', '..', 'package.json'),
      join(process.cwd(), 'package.json'),
    ];
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        const raw = await readFile(p, 'utf-8');
        const pkg = JSON.parse(raw) as { version?: string; name?: string };
        if (pkg.name === 'harness-kit' && pkg.version) {
          pkgVersion = pkg.version;
          break;
        }
      }
    }
  } catch {
    // use default
  }
  console.log(ok(`harness-kit v${pkgVersion}`));

  // 3. HARNESS_MODULE_ROOT env var
  const moduleRootEnv = process.env['HARNESS_MODULE_ROOT'];
  if (moduleRootEnv) {
    console.log(ok(`HARNESS_MODULE_ROOT=${moduleRootEnv}`));
  } else {
    const defaultGlobal = join(homedir(), '.harness-kit', 'modules');
    console.log(fail(`HARNESS_MODULE_ROOT not set (using default: ~/.harness-kit/modules/)`));
    issues.push('HARNESS_MODULE_ROOT not set');
    suggestions.push(`export HARNESS_MODULE_ROOT=${defaultGlobal}`);
  }

  // 4. Global modules directory
  const globalDir = moduleRootEnv ?? join(homedir(), '.harness-kit', 'modules');
  if (existsSync(globalDir) && statSync(globalDir).isDirectory()) {
    const count = countModulesInDir(globalDir);
    console.log(ok(`Global modules directory found: ${globalDir} (${count} modules)`));
  } else {
    console.log(fail(`Global modules directory not found: ~/.harness-kit/modules/`));
    issues.push('Global modules directory missing');
    suggestions.push(`Run 'mkdir -p ~/.harness-kit/modules' to create global directory`);
  }

  // 5. Local modules directory
  const localModulesDir = join(process.cwd(), '.harness', 'modules');
  if (existsSync(localModulesDir) && statSync(localModulesDir).isDirectory()) {
    const count = countModulesInDir(localModulesDir);
    console.log(ok(`Local modules: .harness/modules/ (${count} modules)`));
  } else {
    console.log(fail(`Local modules directory not found: .harness/modules/`));
    issues.push('Local modules directory missing');
    suggestions.push(`Run 'mkdir -p .harness/modules' to create local directory`);
  }

  // 6. harness.config.yaml existence and validity
  const configPath = join(process.cwd(), 'harness.config.yaml');
  if (existsSync(configPath)) {
    try {
      const raw = await readFile(configPath, 'utf-8');
      const parsedConfig = yaml.load(raw);
      const result = HarnessConfigSchema.safeParse(parsedConfig);
      if (result.success) {
        console.log(ok('harness.config.yaml found and valid'));
      } else {
        const errorSummary = result.error.issues.map((i) => i.message).join(', ');
        console.log(warn(`harness.config.yaml found but invalid: ${errorSummary}`));
        issues.push('harness.config.yaml validation failed');
        suggestions.push('Fix harness.config.yaml schema errors');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(warn(`harness.config.yaml found but cannot be parsed: ${msg}`));
      issues.push('harness.config.yaml parse error');
      suggestions.push('Fix harness.config.yaml YAML syntax');
    }
  } else {
    console.log(fail('harness.config.yaml not found'));
    issues.push('harness.config.yaml not found');
    suggestions.push("Run 'harness-kit init' to create harness.config.yaml");
  }

  // 7. Build manifest sync check
  const manifestPath = join(process.cwd(), '.harness', '.build-manifest.json');
  if (existsSync(manifestPath) && existsSync(configPath)) {
    try {
      const manifestMtime = statSync(manifestPath).mtimeMs;
      const configMtime = statSync(configPath).mtimeMs;
      if (configMtime > manifestMtime) {
        console.log(warn('Build out of sync (config modified after last build)'));
        issues.push('Build out of sync');
        suggestions.push("Run 'harness-kit build' to sync build output");
      } else {
        console.log(ok('Build is up to date'));
      }
    } catch {
      console.log(warn('Could not check build sync status'));
    }
  } else if (!existsSync(manifestPath) && existsSync(configPath)) {
    console.log(warn('No build manifest found — build has not been run yet'));
    issues.push('Build not yet run');
    suggestions.push("Run 'harness-kit build' to sync build output");
  }

  // 8. Claude Code installation check
  try {
    const claudePath = execSync('which claude 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (claudePath) {
      console.log(ok(`Claude Code installed: ${claudePath}`));
    } else {
      console.log(warn('Claude Code not found in PATH'));
      issues.push('Claude Code not installed');
    }
  } catch {
    console.log(warn('Claude Code not found in PATH'));
    issues.push('Claude Code not installed or not in PATH');
  }

  // Summary
  console.log('');
  if (issues.length === 0) {
    console.log(`${GREEN}No issues found${RESET}`);
  } else {
    console.log(`Issues found: ${issues.length}`);
    for (const suggestion of suggestions) {
      console.log(`  ${suggestion}`);
    }
  }
  console.log('');
}
