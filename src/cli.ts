#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('harness-kit')
  .description('Claude Code harness framework')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize harness-kit for a project')
  .action(async () => {
    console.log('harness-kit init — coming soon');
  });

program
  .command('build')
  .description('Build Claude Code configuration from modules')
  .option('--verbose', 'Show detailed build log')
  .option('--dry-run', 'Preview changes without writing files')
  .option('--output-dir <dir>', 'Output directory', '.')
  .action(async (opts) => {
    console.log('harness-kit build — coming soon', opts);
  });

program
  .command('list')
  .description('List available modules')
  .option('--search <query>', 'Search modules by keyword')
  .action(async (opts) => {
    console.log('harness-kit list — coming soon', opts);
  });

program
  .command('import <file>')
  .description('Import existing CLAUDE.md into modules')
  .action(async (file) => {
    console.log(`harness-kit import ${file} — coming soon`);
  });

program
  .command('doctor')
  .description('Diagnose harness-kit environment')
  .action(async () => {
    console.log('harness-kit doctor — coming soon');
  });

program.parse();
