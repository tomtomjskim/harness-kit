# harness-kit

Claude Code 전용 하네스 프레임워크 — hooks, MCP, agents, permissions, workflows를 모듈화하여 관리

## 왜 harness-kit인가?

기존 도구들(Ruler, ai-rulez, block/ai-rules)은 텍스트 규칙 파일(CLAUDE.md, .cursorrules)만 관리합니다.
harness-kit은 Claude Code의 **프로그래매틱 설정 전체**를 모듈화합니다:

| 모듈 타입 | 빌드 대상 | 기존 도구 지원 |
|-----------|----------|---------------|
| **instruction** | CLAUDE.md | O (모든 도구) |
| **hook** | settings.json → hooks | X |
| **mcp** | settings.json → mcpServers | X |
| **permission** | settings.local.json | X |
| **agent** | .claude/agents/*.md | X |
| **workflow** | .claude/workflows/*.yaml | X |
| **skill** | .claude/skills/*/SKILL.md | X |
| **preset** | 위 타입 조합 | X |

## Before / After

### Before: 수동 관리

```
projects/
  sports-analysis/CLAUDE.md       ← 수동 작성 (105줄)
  service-portal/CLAUDE.md        ← 수동 작성 (겹치는 내용 복붙)
  blog-automation/.claude/CLAUDE.md ← 수동 작성 (또 복붙)

문제:
  - Docker 배포 명령이 3개 파일에 중복
  - 글로벌 규칙 변경 → 3개 파일 수동 편집
  - hooks를 각 프로젝트 settings.json에 직접 복붙
  - 실수로 CLAUDE.md 망가뜨리면 git restore
```

### After: harness-kit 관리

```
~/.harness-kit/modules/
  base.md                  ← 공통 규칙 (한 번 작성)
  docker-project.md        ← 배포 규칙 (변수만 다름)
  security-gate.yaml       ← 보안 hook (모든 프로젝트 공유)

projects/
  sports-analysis/
    harness.config.yaml    ← vars: { service_name: sports-web, mem_limit: 1536m }
    .harness/modules/      ← 프로젝트 고유 규칙만
  service-portal/
    harness.config.yaml    ← vars: { service_name: portal-api, mem_limit: 384m }
  blog-automation/
    harness.config.yaml    ← vars: { service_name: blog-automation, mem_limit: 256m }

효과:
  - 글로벌 규칙 변경 → 모듈 1개 수정 → harness-kit build 3회
  - hook/MCP 추가 → config에 1줄 추가 → build
  - CLAUDE.md 망가져도 harness-kit build로 재생성
```

## 이런 분에게 맞습니다

- Claude Code 프로젝트가 **3개 이상**이고, CLAUDE.md 복붙이 귀찮은 분
- hooks, MCP, agents 설정을 **프로젝트 간에 재사용**하고 싶은 분
- Claude Code 설정을 **코드처럼 버전 관리**하고 싶은 분
- 팀에서 **동일한 AI 규칙**을 공유해야 하는 분

## 솔직한 장단점

### 장점

| 항목 | 설명 |
|------|------|
| **중복 제거** | 공통 규칙을 모듈 1개로 관리, N개 프로젝트에 재사용 |
| **변수 주입** | Docker IP, 서비스명 등을 vars로 파라미터화 — 복붙 없이 값만 변경 |
| **hooks/MCP 모듈화** | 텍스트 규칙뿐 아니라 hooks, MCP, permissions도 모듈로 재사용 (기존 도구에 없는 기능) |
| **재현성** | `harness-kit build` 한 번으로 동일한 설정 재생성 가능 |
| **환경 분리** | `--profile dev/prod`로 개발/운영 설정 분리 |
| **Claude Code 통합** | `/harness` 커맨드 + 자동감지 스킬 + auto-build hook이 빌드 시 자동 생성 |
| **안전장치** | 자동생성 마킹으로 수동 편집 방지, atomic write로 빌드 실패 시 롤백 |

### 단점 / 한계

| 항목 | 설명 |
|------|------|
| **학습 비용** | harness.config.yaml 작성법, 모듈 구조를 익혀야 함 |
| **간접 레이어 추가** | CLAUDE.md를 직접 편집하는 것보다 한 단계 더 거침 |
| **프로젝트 1-2개면 과잉** | 프로젝트가 적으면 "그냥 직접 편집"이 더 빠름 |
| **빌드 필요** | 설정 변경 시 `harness-kit build`를 실행해야 함 (auto-build hook으로 완화) |
| **npm 미배포** | 현재 git clone + npm link 방식으로만 설치 가능 |

### 효과가 커지는 시점

```
프로젝트 1-2개  → 직접 편집이 더 빠름 (harness-kit 불필요)
프로젝트 3-5개  → 공통 모듈 재사용 효과 체감 시작
프로젝트 5개+   → 글로벌 모듈 변경 1회로 전체 동기화, 없으면 불편
팀 2명+        → 동일 규칙 공유 + profile로 환경 분리가 필수
```

### 부수 효과: 학습 가치

이 도구를 만드는 과정에서 체계화된 [학습 문서 7편](#학습-문서)이 포함되어 있습니다:
- Claude Code 설정 파일 전체 구조
- hooks 17개 이벤트와 실전 패턴
- MCP 서버 조합, 멀티에이전트 설계
- 경쟁 도구 생태계 (Ruler, ai-rulez, AGENTS.md 표준)

**이 지식 자체가 harness-kit 코드 못지않게 가치 있습니다.** 도구를 안 쓰더라도 docs/ 폴더만 참고해도 됩니다.

## Quick Start

### 설치

```bash
# 1. 클론 + 빌드
git clone https://github.com/tomtomjskim/harness-kit.git ~/.harness-kit/source
cd ~/.harness-kit/source && npm install && npm run build

# 2. 글로벌 CLI 등록
npm link

# 3. 환경변수 설정
echo 'export HARNESS_MODULE_ROOT="$HOME/.harness-kit/modules"' >> ~/.bashrc
source ~/.bashrc

# 4. 글로벌 모듈 설치
harness-kit install-modules --link

# 5. 환경 확인
harness-kit doctor
```

### 프로젝트에 적용

```bash
cd your-project

# 새 프로젝트: 자동 감지 → 모듈 추천 → 즉시 빌드
harness-kit init

# 기존 프로젝트: CLAUDE.md → 모듈 분해
harness-kit import ./CLAUDE.md
# → .harness/modules/ 에 모듈 파일 생성
# → harness.config.yaml 수동 작성 후 build
harness-kit build
```

## CLI 명령

| 명령 | 설명 |
|------|------|
| `harness-kit build` | 모듈 → Claude Code 설정 빌드 |
| `harness-kit build --verbose` | 상세 빌드 로그 |
| `harness-kit build --dry-run` | 파일 생성 없이 미리보기 |
| `harness-kit build --profile prod` | 환경별 프로파일 빌드 |
| `harness-kit init` | 프로젝트 초기화 (감지 → 추천 → 빌드) |
| `harness-kit list` | 사용 가능 모듈 목록 |
| `harness-kit list --search security` | 모듈 검색 |
| `harness-kit import ./CLAUDE.md` | 기존 CLAUDE.md → 모듈 분해 |
| `harness-kit create-module my-rule` | 새 모듈 템플릿 생성 |
| `harness-kit create-module my-hook --type hook` | 타입 지정 모듈 생성 |
| `harness-kit install-modules` | 내장 모듈을 글로벌에 설치 |
| `harness-kit install-modules --link` | symlink 방식 설치 |
| `harness-kit doctor` | 환경 진단 |

## harness.config.yaml 예시

```yaml
version: "1"
name: my-project

modules:
  # Instructions (CLAUDE.md에 삽입)
  - name: base
  - name: korean-conventions
  - name: nextjs
  - name: docker-project
    vars:
      service_name: my-app
      container_ip: "172.20.0.10"
      mem_limit: 512m
  - name: git-pr-flow
    vars:
      base_branch: main
      dev_branch: dev

  # Hooks (settings.json에 삽입)
  - name: security-gate
  - name: auto-format
  - name: commit-guard

  # MCP (settings.json에 삽입)
  - name: serena

  # Agents (.claude/agents/에 생성)
  - name: architect
  - name: developer

  # 조건부 모듈 (when)
  - name: docker-safe
    when:
      file_exists: Dockerfile

settings:
  language: korean
  effortLevel: high

custom:
  - id: overview
    section: "## Overview"
    position: prepend
    content: |
      프로젝트 개요 내용...

  - id: api-rules
    section: "## API Rules"
    content: |
      프로젝트 고유 API 규칙...

profiles:
  dev:
    modules:
      - name: security-gate
  prod:
    modules:
      - name: security-gate
      - name: git-safe
      - name: docker-safe
      - name: commit-guard
```

## 빌드 시 자동 생성되는 파일

| 파일 | 역할 |
|------|------|
| `CLAUDE.md` | instruction 모듈 병합 + custom 블록 |
| `.claude/settings.json` | hooks + MCP 서버 + auto-build hook |
| `.claude/settings.local.json` | permissions (allow/deny) |
| `.claude/agents/*.md` | 에이전트 정의 |
| `.claude/commands/harness.md` | `/harness` 슬래시 커맨드 (자동 생성) |
| `.claude/skills/harness-kit/SKILL.md` | 자동 감지 스킬 (CLAUDE.md 직접 수정 방지) |
| `.harness/.build-manifest.json` | 빌드 해시 + 메타데이터 |

## 내장 모듈 (20개)

### Instructions (8개)
| 모듈 | 설명 | 변수 |
|------|------|------|
| `base` | 모든 프로젝트 공통 규칙 | - |
| `korean-conventions` | 한국어 프로젝트 컨벤션 | - |
| `docker-project` | Docker 빌드/배포 규칙 | `service_name`, `compose_file`, `container_ip`, `mem_limit` |
| `nextjs` | Next.js 15 App Router 규칙 | - |
| `express` | Express.js API 서버 컨벤션 | - |
| `fastapi` | FastAPI/Python 컨벤션 | - |
| `postgresql` | PostgreSQL DB 규칙 | `db_name`, `schema_name` |
| `git-pr-flow` | PR 기반 Git 워크플로우 | `base_branch`, `dev_branch` |

### Hooks (5개)
| 모듈 | 이벤트 | 설명 |
|------|--------|------|
| `security-gate` | PreToolUse | 위험 명령 차단 (rm -rf, DROP 등) |
| `auto-format` | PostToolUse | 파일 변경 후 자동 포맷팅 |
| `test-runner` | PostToolUse | 코드 변경 후 자동 테스트 |
| `commit-guard` | PreToolUse | git commit 전 lint 실행 |
| `notify` | Notification | 작업 완료 OS 알림 |

### MCP (1개)
| 모듈 | 설명 |
|------|------|
| `serena` | Serena 시맨틱 코드 분석 MCP 서버 |

### Agents (3개)
| 모듈 | 역할 | 도구 권한 |
|------|------|----------|
| `architect` | 시스템 설계, 기술 결정 | 읽기 전용 |
| `developer` | 코드 구현, 버그 수정 | 읽기 + 쓰기 |
| `security-reviewer` | 보안 코드 리뷰 | 읽기 전용 |

### Permissions (2개)
| 모듈 | 설명 |
|------|------|
| `docker-safe` | Docker 안전 권한 (위험 명령 deny) |
| `git-safe` | Git 안전 권한 (force push, reset --hard deny) |

### Workflows (1개)
| 모듈 | 설명 |
|------|------|
| `standard` | 7단계 표준 개발 워크플로우 |

## 아키텍처

### 빌드 파이프라인 (6단계)

```
harness.config.yaml
       ↓
  Resolver    — 모듈 경로 해결 + fuzzy match + when 조건 평가
       ↓
  Loader      — gray-matter frontmatter + 타입별 body 파싱
       ↓
  Validator   — Zod 스키마 검증 + 사이클 탐지 + required 변수 확인
       ↓
  Merger      — 타입별 병합 (event-merge, merge-key, union-set, file-per)
       ↓
  Renderer    — mustache strict 변수 주입 + per-module vars
       ↓
  Writer      — atomic rename + self-referential 헤더 + manifest
       ↓
  CLAUDE.md + .claude/settings.json + .claude/agents/ + ...
```

### 모듈 탐색 우선순위

```
1. .harness/modules/          (프로젝트 로컬)
2. ~/.harness-kit/modules/    (글로벌)
```

### 병합 규칙

| 타입 | 규칙 | 출력 파일 |
|------|------|----------|
| instruction | append (선언 순서) | CLAUDE.md |
| hook | event-merge (이벤트별 배열 누적) | settings.json |
| mcp | merge-key (중복 키 → 에러) | settings.json |
| permission | union-set (deny 우선) | settings.local.json |
| agent | file-per (독립 파일) | .claude/agents/ |
| workflow | file-per | .claude/workflows/ |
| skill | file-per + attachments | .claude/skills/ |

## 학습 문서

하네스 엔지니어링의 개념부터 실전 패턴까지 7편의 학습 문서:

1. [하네스 엔지니어링이란?](docs/harness-engineering/01-what-is-harness.md) — 개념, Context Engineering, Hot/Cold Memory
2. [Claude Code 설정 파일 해부](docs/harness-engineering/02-claude-code-anatomy.md) — 전체 파일 계층, 우선순위
3. [Hooks 심화](docs/harness-engineering/03-hooks-deep-dive.md) — 17개 이벤트, 실전 유즈케이스 5선
4. [MCP 서버 조합 패턴](docs/harness-engineering/04-mcp-patterns.md) — 5개 대표 MCP, 프로젝트별 추천
5. [멀티에이전트 설계](docs/harness-engineering/05-agents-design.md) — 2-레이어 패턴, 최소 권한 원칙
6. [Memory 계층 설계](docs/harness-engineering/06-memory-system.md) — CLAUDE.md + MEMORY.md, 작성 가이드
7. [생태계 현황](docs/harness-engineering/07-ecosystem-landscape.md) — 경쟁 도구 비교, 블루오션 분석

## 개발 히스토리

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 0 | 학습 문서 7편 + 프로젝트 골격 + Zod 스키마 | 완료 |
| Phase 1 | 빌드 파이프라인 6단계 + CLI 5개 + 내장 모듈 10개 | 완료 |
| Phase 1.5 | Dog-fooding 3개 프로젝트 (평균 99% 커버리지) | 완료 |
| 보일러플레이트 | /harness 커맨드 + 스킬 + auto-build hook 자동 생성 | 완료 |
| 설계 개선 | when 조건, 36개 테스트, create-module, 에러 통일 | 완료 |
| 모듈 확장 | 추가 모듈 10개 + install-modules + --profile | 완료 |
| 프로젝트 전환 | 3개 프로젝트 harness-kit 관리 체제로 실 전환 | 완료 |

## License

MIT
