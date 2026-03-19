#!/usr/bin/env node
import { Command } from 'commander';
import { buildFromFile } from './commands/build.js';
import { createModuleCommand } from './commands/create-module.js';
import { HarnessError } from './errors.js';

process.on('unhandledRejection', (err) => {
  if (err instanceof HarnessError) {
    console.error(`[harness-kit] Error (${err.code}): ${err.message}`);
  } else if (err instanceof Error) {
    console.error(`[harness-kit] ${err.message}`);
  } else {
    console.error(`[harness-kit] Unexpected error: ${err}`);
  }
  process.exit(1);
});

const program = new Command();

program
  .name('harness-kit')
  .description('Claude Code harness framework')
  .version('0.1.0');

// ─── build ───────────────────────────────────────────────────────────────────

program
  .command('build')
  .description('Build Claude Code configuration from modules')
  .option('--verbose', 'Show detailed build log')
  .option('--dry-run', 'Preview changes without writing files')
  .option('--output-dir <dir>', 'Output directory', '.')
  .option('--profile <name>', 'Build profile (dev/prod)')
  .option('--config <path>', 'Path to harness.config.yaml', 'harness.config.yaml')
  .option('--local-dir <dir>', 'Local modules directory (default: .harness/modules)')
  .option('--global-dir <dir>', 'Global modules directory (default: ~/.harness-kit/modules)')
  .action(async (opts: {
    verbose?: boolean;
    dryRun?: boolean;
    outputDir: string;
    profile?: string;
    config: string;
    localDir?: string;
    globalDir?: string;
  }) => {
    try {
      await buildFromFile(opts.config, {
        verbose: opts.verbose,
        dryRun: opts.dryRun,
        outputDir: opts.outputDir,
        localDir: opts.localDir,
        globalDir: opts.globalDir,
      });
    } catch (err) {
      if (err instanceof HarnessError) {
        console.error(`[harness-kit] Error (${err.code}): ${err.message}`);
      } else if (err instanceof Error) {
        console.error(`[harness-kit] ${err.message}`);
      } else {
        console.error(`[harness-kit] Unexpected error: ${err}`);
      }
      process.exit(1);
    }
  });

// ─── init ────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize harness-kit for a project')
  .option('--preset <name>', 'Apply a preset')
  .option('--force', 'Overwrite existing config')
  .action(async (opts: { preset?: string; force?: boolean }) => {
    try {
      const { initCommand } = await import('./commands/init.js');
      await initCommand(opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });

// ─── list ────────────────────────────────────────────────────────────────────

program
  .command('list [category]')
  .description('List available modules')
  .option('--search <query>', 'Search modules by keyword')
  .action(async (category: string | undefined, opts: { search?: string }) => {
    try {
      const { listCommand } = await import('./commands/list.js');
      await listCommand(category, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });

// ─── import ──────────────────────────────────────────────────────────────────

program
  .command('import <file>')
  .description('Import existing CLAUDE.md into harness modules')
  .option('--output-dir <dir>', 'Output directory for generated modules', '.harness/modules')
  .action(async (file: string, opts: { outputDir?: string }) => {
    try {
      const { importCommand } = await import('./commands/import.js');
      await importCommand(file, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });

// ─── doctor ──────────────────────────────────────────────────────────────────

program
  .command('doctor')
  .description('Diagnose harness-kit environment')
  .action(async () => {
    try {
      const { doctorCommand } = await import('./commands/doctor.js');
      await doctorCommand();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });

// ─── create-module ───────────────────────────────────────────────────────────

program
  .command('create-module <name>')
  .description('Create a new module from template')
  .option('--type <type>', 'Module type (instruction, hook, mcp, agent, workflow, permission, skill)', 'instruction')
  .option('--output-dir <dir>', 'Output directory', '.harness/modules')
  .action(async (name: string, opts: { type?: string; outputDir?: string }) => {
    try {
      await createModuleCommand(name, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    }
  });

// ─── parse ───────────────────────────────────────────────────────────────────

program.parse();
