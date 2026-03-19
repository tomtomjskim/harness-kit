import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface CreateModuleOptions {
  type?: string;
  outputDir?: string;
}

type ModuleType = 'instruction' | 'hook' | 'mcp' | 'agent' | 'workflow' | 'permission' | 'skill';

const VALID_TYPES: ModuleType[] = [
  'instruction',
  'hook',
  'mcp',
  'agent',
  'workflow',
  'permission',
  'skill',
];

function toKebabCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildTemplate(name: string, type: ModuleType): { content: string; ext: string } {
  switch (type) {
    case 'instruction':
      return {
        ext: 'md',
        content: `---
name: ${name}
type: instruction
description: TODO - 설명을 입력하세요
tags: []
section: "## TODO"
priority: 50
---

TODO - 여기에 내용을 작성하세요
`,
      };

    case 'hook':
      return {
        ext: 'yaml',
        content: `---
name: ${name}
type: hook
description: TODO - 설명을 입력하세요
tags: []
priority: 50
---

event: PreToolUse
matcher: Bash
hooks:
  - type: command
    command: "echo 'TODO: implement hook'"
    timeout: 5000
`,
      };

    case 'mcp':
      return {
        ext: 'yaml',
        content: `---
name: ${name}
type: mcp
description: TODO - 설명을 입력하세요
tags: []
priority: 50
---

command: npx
args:
  - TODO-package-name
`,
      };

    case 'agent':
      return {
        ext: 'md',
        content: `---
name: ${name}
type: agent
description: TODO - 설명을 입력하세요
tags: []
priority: 50
model: sonnet
tools: []
---

# ${name}

TODO - 에이전트 역할과 지침을 작성하세요
`,
      };

    case 'workflow':
      return {
        ext: 'yaml',
        content: `---
name: ${name}
type: workflow
description: TODO - 설명을 입력하세요
tags: []
priority: 50
---

phases:
  - name: TODO - phase 이름
    description: TODO - phase 설명
    steps:
      - TODO - step 내용
`,
      };

    case 'permission':
      return {
        ext: 'yaml',
        content: `---
name: ${name}
type: permission
description: TODO - 설명을 입력하세요
tags: []
priority: 50
---

allow:
  - TODO - 허용할 패턴
deny:
  - TODO - 거부할 패턴
`,
      };

    case 'skill':
      return {
        ext: 'md',
        content: `---
name: ${name}
type: skill
description: TODO - 설명을 입력하세요
tags: []
priority: 50
---

# ${name} Skill

## Description

TODO - 스킬 설명을 입력하세요

## Usage

TODO - 사용 방법을 입력하세요

## Examples

TODO - 예시를 입력하세요
`,
      };
  }
}

export async function createModuleCommand(
  name: string,
  options: CreateModuleOptions,
): Promise<void> {
  const normalizedName = toKebabCase(name);
  if (!normalizedName) {
    process.stderr.write(`Error: "${name}" cannot be normalized to a valid kebab-case name.\n`);
    process.exit(1);
  }

  const type = (options.type ?? 'instruction') as ModuleType;
  if (!VALID_TYPES.includes(type)) {
    process.stderr.write(
      `Error: Invalid type "${type}". Valid types: ${VALID_TYPES.join(', ')}\n`,
    );
    process.exit(1);
  }

  const outputDir = options.outputDir ?? '.harness/modules';
  const { content, ext } = buildTemplate(normalizedName, type);
  const filePath = join(outputDir, `${normalizedName}.${ext}`);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');

  process.stdout.write(`Created: ${filePath}\n`);
}
