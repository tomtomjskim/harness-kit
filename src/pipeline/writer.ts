import { mkdir, writeFile, rm, rename, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import type { MergedOutput } from './merger.js';
import type { BuildManifest } from '../types/index.js';

const HARNESS_VERSION = '0.1.0';

export interface WrittenFile {
  path: string;
  size: number;
  hash: string;
}

export interface WriterResult {
  files: WrittenFile[];
  dryRun: boolean;
  manifestPath: string;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function buildHeader(configHash: string): string {
  const ts = new Date().toISOString();
  return [
    `<!-- harness-kit v${HARNESS_VERSION} | built: ${ts} | hash: ${configHash} -->`,
    `<!-- DO NOT EDIT DIRECTLY. Modify harness.config.yaml and run: harness-kit build -->`,
  ].join('\n');
}

interface FileEntry {
  relativePath: string;   // relative to outputDir
  content: string;
}

function collectFiles(output: MergedOutput): FileEntry[] {
  const files: FileEntry[] = [];

  // CLAUDE.md is handled separately (header prepended in write())
  files.push({ relativePath: 'CLAUDE.md', content: output.claudeMd });

  // settings.json
  files.push({
    relativePath: '.claude/settings.json',
    content: JSON.stringify(output.settingsJson, null, 2),
  });

  // settings.local.json
  files.push({
    relativePath: '.claude/settings.local.json',
    content: JSON.stringify(output.settingsLocalJson, null, 2),
  });

  // Agent files → .claude/agents/<name>.md
  for (const [name, content] of output.agentFiles) {
    files.push({ relativePath: `.claude/agents/${name}.md`, content });
  }

  // Workflow files → .claude/workflows/<name>.yaml (if string) or yaml.dump (if already object)
  for (const [name, content] of output.workflowFiles) {
    const fileContent =
      typeof content === 'string' ? content : yaml.dump(content);
    files.push({ relativePath: `.claude/workflows/${name}.yaml`, content: fileContent });
  }

  // Skill files → .claude/commands/<name>.md
  for (const [name, skill] of output.skillFiles) {
    files.push({ relativePath: `.claude/commands/${name}.md`, content: skill.skillMd });
    if (skill.attachments) {
      for (const attachment of skill.attachments) {
        files.push({
          relativePath: `.claude/commands/${name}/${attachment}`,
          content: '',
        });
      }
    }
  }

  // ── Boilerplate: Claude Code integration files ──

  // 1. Custom Command: /harness slash command
  files.push({
    relativePath: '.claude/commands/harness.md',
    content: [
      '---',
      'description: harness-kit 모듈 관리 (build, list, import, doctor)',
      '---',
      '',
      '$ARGUMENTS 를 분석하여 적절한 harness-kit CLI 명령을 실행하세요.',
      '',
      '사용 가능한 명령:',
      '- `harness-kit build [--verbose] [--dry-run]` — 모듈에서 Claude Code 설정 빌드',
      '- `harness-kit list [--search <query>]` — 사용 가능 모듈 목록',
      '- `harness-kit import <file>` — 기존 CLAUDE.md를 모듈로 분해',
      '- `harness-kit doctor` — 환경 진단',
      '',
      '환경변수 HARNESS_MODULE_ROOT가 설정되어 있는지 먼저 확인하세요.',
      '설정되지 않았으면 `export HARNESS_MODULE_ROOT=~/.harness-kit/modules` 를 안내하세요.',
      '',
      '인자가 없으면 사용 가능한 명령 목록을 보여주세요.',
      '',
    ].join('\n'),
  });

  // 2. Skill: auto-detection for harness-kit managed projects
  files.push({
    relativePath: '.claude/skills/harness-kit/SKILL.md',
    content: [
      '---',
      'name: harness-kit-managed',
      'description: harness.config.yaml이 있는 프로젝트에서 CLAUDE.md 직접 수정 방지 및 harness-kit 빌드 안내',
      '---',
      '',
      '이 프로젝트는 **harness-kit**으로 Claude Code 설정을 관리합니다.',
      '',
      '## 규칙',
      '- CLAUDE.md를 직접 수정하지 마세요 (자동 생성 파일)',
      '- 설정 변경은 `harness.config.yaml`을 편집한 후 `harness-kit build`를 실행하세요',
      '- `.claude/settings.json`, `.claude/agents/`, `.claude/commands/harness.md`도 자동 생성됩니다',
      '',
      '## 빠른 명령',
      '- `/harness build` — 설정 빌드',
      '- `/harness list` — 모듈 목록',
      '- `/harness doctor` — 환경 진단',
      '',
    ].join('\n'),
  });

  return files;
}

export async function write(
  output: MergedOutput,
  options: { outputDir: string; dryRun?: boolean; configHash?: string },
): Promise<WriterResult> {
  const { outputDir, dryRun = false, configHash = sha256(JSON.stringify(output)) } = options;
  const tmpDir = join(outputDir, '.harness-tmp');

  const files = collectFiles(output);
  const header = buildHeader(configHash);
  const writtenFiles: WrittenFile[] = [];

  if (dryRun) {
    // Dry-run: just collect info without writing
    for (const file of files) {
      let content = file.content;
      if (file.relativePath === 'CLAUDE.md') {
        content = header + '\n\n' + content;
      }
      writtenFiles.push({
        path: join(outputDir, file.relativePath),
        size: Buffer.byteLength(content, 'utf-8'),
        hash: sha256(content),
      });
    }
    return { files: writtenFiles, dryRun: true, manifestPath: join(outputDir, '.harness/.build-manifest.json') };
  }

  // Atomic write: write everything to tmpDir, then rename
  try {
    // Clean up any leftover tmpDir
    if (existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true });
    }
    await mkdir(tmpDir, { recursive: true });

    for (const file of files) {
      let content = file.content;
      if (file.relativePath === 'CLAUDE.md') {
        content = header + '\n\n' + content;
      }

      // Path traversal guard: ensure output stays within outputDir
      const destPath = resolvePath(join(outputDir, file.relativePath));
      const resolvedOutputDir = resolvePath(outputDir);
      if (!destPath.startsWith(resolvedOutputDir)) {
        throw new Error(`Path traversal detected: "${file.relativePath}" resolves outside output directory`);
      }

      const tmpPath = join(tmpDir, file.relativePath);
      await mkdir(dirname(tmpPath), { recursive: true });
      await writeFile(tmpPath, content, 'utf-8');

      writtenFiles.push({
        path: join(outputDir, file.relativePath),
        size: Buffer.byteLength(content, 'utf-8'),
        hash: sha256(content),
      });
    }

    // Build manifest
    const manifest: BuildManifest = {
      version: '1',
      built_at: new Date().toISOString(),
      config_hash: configHash,
      modules: writtenFiles.map((f) => ({
        name: f.path.split('/').pop()!,
        path: f.path,
        hash: f.hash,
      })),
      output_hash: sha256(writtenFiles.map((f) => f.hash).join(':')),
    };
    const manifestRelPath = '.harness/.build-manifest.json';
    const manifestContent = JSON.stringify(manifest, null, 2);
    const manifestTmpPath = join(tmpDir, manifestRelPath);
    await mkdir(dirname(manifestTmpPath), { recursive: true });
    await writeFile(manifestTmpPath, manifestContent, 'utf-8');

    // Atomic rename: move each file from tmpDir to outputDir
    for (const file of files) {
      const srcPath = join(tmpDir, file.relativePath);
      const destPath = join(outputDir, file.relativePath);
      await mkdir(dirname(destPath), { recursive: true });
      await rename(srcPath, destPath);
    }

    // Move manifest
    const manifestDestPath = join(outputDir, manifestRelPath);
    await mkdir(dirname(manifestDestPath), { recursive: true });
    await rename(manifestTmpPath, manifestDestPath);

    // Clean up tmpDir
    await rm(tmpDir, { recursive: true, force: true });

    return {
      files: writtenFiles,
      dryRun: false,
      manifestPath: join(outputDir, manifestRelPath),
    };
  } catch (err) {
    // Cleanup on failure
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}
