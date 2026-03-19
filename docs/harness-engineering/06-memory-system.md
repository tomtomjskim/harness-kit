# 06. CLAUDE.md와 Memory 계층 설계

> Phase 0 학습 문서 | 대상 독자: harness-kit 기여자, Claude Code 고급 사용자

---

## 1. 설정 계층 구조

Claude Code는 세 수준의 설정 계층을 가진다. 상위 계층이 하위 계층에 우선한다.

```
우선순위 높음 ──────────────────────────── 우선순위 낮음

Managed Policy           Project CLAUDE.md        User CLAUDE.md
(Anthropic 관리)    >    /project/CLAUDE.md   >   ~/.claude/CLAUDE.md
  읽기 전용              git 체크인                전역 설정
  기업/팀 강제 정책      프로젝트별 규칙           개인 공통 설정
```

### 파일별 역할과 위치

| 파일 | 위치 | 관리 주체 | Git 여부 |
|------|------|----------|---------|
| User CLAUDE.md | `~/.claude/CLAUDE.md` | 개인 | 아니오 |
| Project CLAUDE.md | `<project-root>/CLAUDE.md` | 팀 | **예** |
| Local settings | `.claude/settings.local.json` | 개인 | **아니오** (gitignore) |

### 계층 상속 동작

Claude Code가 프로젝트를 열면 아래 순서로 설정을 로드한다.

```
1. ~/.claude/CLAUDE.md         → 글로벌 공통 규칙 로드
2. /project/CLAUDE.md          → 프로젝트 규칙 추가 (충돌 시 우선)
3. .claude/settings.local.json → 로컬 개인 오버라이드 적용
```

두 CLAUDE.md가 동시에 적용되므로, 글로벌에 정의한 내용은 프로젝트에서 반복하지 않아도 된다.

---

## 2. CLAUDE.md 작성 베스트 프랙티스

### 황금률: 200줄 이하 유지

CLAUDE.md는 **컨텍스트 창에 항상 포함되는** 파일이다. 길면 길수록 실제 작업에 쓸 수 있는 컨텍스트가 줄어든다.

```
# 나쁜 예: CLAUDE.md에 코드 전체를 넣는 경우
## API 엔드포인트 목록
GET /api/users
GET /api/users/:id
POST /api/users
PUT /api/users/:id
DELETE /api/users/:id
... (50개 엔드포인트)

# 좋은 예: 위치만 안내
## API 문서
- 상세 엔드포인트: `docs/api-reference.md` 참조
- 모든 엔드포인트는 `/health` 포함 필수
```

### 각 줄의 필요성 자문: "이거 없으면 Claude가 실수하나?"

```markdown
# CLAUDE.md 줄별 판단 기준

✅ 포함할 것 (Claude가 모르면 실수하는 것들)
  - 빌드 명령: `npm run dev` vs `pnpm dev`
  - 코드 스타일: tabs vs spaces, 따옴표 규칙
  - 아키텍처 결정: "PostgreSQL 직접 접근 금지, 반드시 API 레이어 통해"
  - 테스트 방법: `pnpm test:unit` vs `pnpm test:e2e`
  - 중요 제약: "Docker 없이 실행 불가", "ARM64 빌드 필수"
  - 도메인 규칙: "lotto schema는 appuser 소유"

❌ 포함하지 말 것 (Claude가 코드에서 유추 가능한 것들)
  - package.json에 있는 의존성 목록
  - 코드에서 명백한 파일 구조
  - git history (git log로 확인 가능)
  - 주석으로 설명된 코드 동작
```

### 실제 프로젝트 CLAUDE.md 패턴

```markdown
# Project Name

## Overview
한 문단으로 프로젝트 목적과 핵심 제약 요약.
예: "Next.js 15 기반 로또 분석 서비스. Docker 내부에서만 실행."

## Commands

### Development
\`\`\`bash
npm run dev          # 개발 서버 (포트 3000)
npm run build        # 프로덕션 빌드
npm run test         # 단위 테스트
\`\`\`

### Database
\`\`\`bash
docker exec -it postgres psql -U appuser -d maindb -c "SET search_path TO lotto;"
\`\`\`

## Architecture
- **DB Schema**: lotto 스키마 사용, 직접 SQL 금지 → ORM 레이어 통해
- **State Management**: Zustand (전역), React Query (서버 상태)
- **API Format**: 모든 응답은 `{ ok: boolean, data?: T, error?: string }` 형식

## Conventions
- Korean comments acceptable
- `/health` endpoint 필수
- 환경변수는 docker-compose.yml에서 주입, .env 직접 읽기 금지

## Git Workflow (필수)
- main 직접 커밋 금지
- 반드시 PR 플로우: dev → PR → main
```

---

## 3. Memory 시스템

### 경로 구조

```
~/.claude/projects/
└── -home-ubuntu/          # 프로젝트 경로를 슬래시→하이픈 변환
    └── memory/
        ├── MEMORY.md      # 인덱스 파일 (200줄 이내)
        ├── project_sokjima.md
        ├── feedback_no_left_bar.md
        └── sports-analysis-improvements.md
```

### MEMORY.md: 인덱스 파일

최상위 인덱스로서, 항상 컨텍스트에 포함된다. 개별 메모리 파일의 요약과 링크를 담는다.

```markdown
# Memory

## Key Decisions
- Blog Automation: `query<T>()` returns `T[]` directly, NOT `{rows: T[]}`
- Docker Claude CLI: symlink 경로 사용 (`/home/ubuntu/.local/bin/claude`)
- Git Workflow: DevNest는 반드시 PR 플로우 (dev → PR → main)

## Active Projects
- [sokjima](project_sokjima.md) — 사기/피싱 방지 플랫폼, MVP 라이브
- [sports-analysis-improvements.md](sports-analysis-improvements.md) — 미완료 2건

## Patterns Learned
- background task agents: 여러 파일 병렬 생성 시 효과적
- OpenClaw 세션 캐시: config 변경 후 세션 초기화 필요
```

### 개별 메모리 파일 구조

각 파일은 frontmatter + 본문으로 구성된다.

```markdown
---
name: feedback_no_left_bar
description: 카드 좌측 컬러바(left-bar) 디자인 패턴 사용 금지
type: feedback       # user | feedback | project | reference
date: 2026-02-15
---

# 카드 좌측 컬러바 사용 금지

## 피드백 내용
카드 컴포넌트에서 좌측에 세로 컬러 바를 추가하는 디자인 패턴은
시각적으로 과도하고 일관성을 해친다.

## 올바른 접근
- 상태 표시: 배지(badge) 사용
- 카테고리 구분: 상단 태그 또는 색상 텍스트 사용
- 강조: 배경색이나 테두리 사용

## 적용 범위
모든 프로젝트의 모든 카드 컴포넌트
```

### 메모리 타입 분류

| 타입 | 설명 | 예시 |
|------|------|------|
| `user` | 사용자 선호/습관 | "한국어 커밋 메시지 선호" |
| `feedback` | 명시적 피드백/수정 요청 | "left-bar 패턴 금지" |
| `project` | 프로젝트 상태/결정사항 | sokjima MVP 완료 현황 |
| `reference` | 참조 정보 | API 키 위치, 서버 구성 |

---

## 4. Hot Memory vs Cold Memory

Codified Context 논문(Anthropic 내부)에서 제안한 분류로, 메모리를 접근 빈도와 로딩 방식으로 구분한다.

### Hot Memory: 항상 컨텍스트에 로딩

```
Hot Memory = 매 세션 시작 시 자동 포함되는 정보

파일:
  ~/.claude/CLAUDE.md       → 글로벌 설정
  /project/CLAUDE.md        → 프로젝트 규칙
  ~/.claude/projects/*/memory/MEMORY.md  → 메모리 인덱스

특징:
  - 컨텍스트 창 사용량: 작을수록 좋음
  - 업데이트 빈도: 낮음 (안정적인 정보)
  - 내용: 규칙, 제약, 핵심 결정사항
```

### Cold Memory: 필요 시 검색/참조

```
Cold Memory = 필요할 때 찾아보는 상세 정보

파일:
  ~/.claude/team/prompts/*.md    → 에이전트 상세 지침
  docs/*.md                      → 프로젝트 문서
  memory/project_*.md            → 프로젝트별 상세 기록

특징:
  - 컨텍스트 창 상시 점유 없음
  - 업데이트 빈도: 높음 (작업 중 계속 업데이트)
  - 내용: 상세 구현 내역, 히스토리
```

### 실용적 분류 기준

```
이 정보가 없으면 Claude가 잘못된 행동을 하나?
  YES → Hot Memory (CLAUDE.md 또는 MEMORY.md에 포함)
  NO  → Cold Memory (별도 파일로 분리, 필요 시 참조)

이 정보를 매 요청마다 알아야 하나?
  YES → CLAUDE.md (항상 로딩)
  NO  → MEMORY.md에 요약 + 별도 파일에 상세
```

---

## 5. 프로젝트별 CLAUDE.md 심화 패턴

### 공통 섹션 구조

모든 프로젝트 CLAUDE.md가 공통으로 가져야 할 섹션이다.

```markdown
# [Project Name]

## Overview      ← 목적, 핵심 제약 (3-5줄)
## Commands      ← 빌드/테스트/실행 명령어
## Architecture  ← 기술 결정사항, 시스템 구성
## Conventions   ← 코딩 규칙, 패턴
```

### 프로젝트별 추가 섹션

```markdown
## Git Workflow (필수)        ← PR 플로우 있는 프로젝트
## DB Schema                  ← DB 집약적 프로젝트
## API Format                 ← API 서비스
## Domain Rules               ← 비즈니스 규칙이 복잡한 경우
## Security Notes             ← 보안 민감 프로젝트
```

### 실제 운영 중인 글로벌 CLAUDE.md 구조

```markdown
# Global Claude Code Configuration

## Multi-Agent Team System         ← 팀 에이전트 시스템 설명
  ### Team Configuration           ← 설정 파일 경로
  ### Available Agents             ← Core 7 + Specialist 6 목록
  ### Workflows                    ← 사용 가능한 워크플로우

## Installed Plugins               ← Superpowers, Skill Creator 등

## Available Tools & Resources
  ### MCP Servers                  ← Serena 사용 가이드
  ### Task Tool 타입별 용도        ← Explore/Plan/general-purpose/Bash
  ### 도구 선택 가이드라인        ← 결정 트리

## Conventions
  ### Session Work Summary (필수)  ← 세션 종료 시 출력 포맷
```

### settings.local.json: 로컬 개인 설정

```json
{
  "permissions": {
    "allow": [
      "Bash(git log:*)",
      "Bash(docker ps:*)",
      "Bash(npm run *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)"
    ]
  },
  "env": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

`.gitignore`에 반드시 포함해야 한다.

```gitignore
.claude/settings.local.json
.env
.env.local
```

---

## 6. 효과적인 계층 설계 전략

### 전략 1: DRY 계층 분리

```
글로벌에만 있어야 할 것:
  - 에이전트 시스템 사용법
  - MCP 도구 선택 가이드
  - 세션 서머리 포맷
  - 개인 코딩 선호

프로젝트에만 있어야 할 것:
  - 해당 프로젝트 빌드 명령
  - 프로젝트 아키텍처 결정
  - 팀 Git 워크플로우
  - 도메인 비즈니스 규칙

절대 중복하지 말 것:
  - 두 파일에 같은 규칙 → 충돌 시 혼란
```

### 전략 2: 변경 빈도에 따른 배치

```
거의 변경 없음 → CLAUDE.md
  예: "tabs 4칸", "모든 API /health 필수"

가끔 변경 → MEMORY.md 인덱스
  예: "현재 진행 중인 프로젝트 목록"

자주 변경 → 개별 메모리 파일
  예: "sokjima 현재 미완료 태스크"
```

### 전략 3: "Claude 실수 방지 문서"로 접근

CLAUDE.md는 API 문서가 아니다. **Claude가 과거에 실수했거나, 미래에 실수할 가능성이 있는 것**을 모아둔 가이드다.

```markdown
# 예시: 실수 방지 관점으로 작성된 CLAUDE.md 섹션

## 중요: 흔한 실수들

### DB 접근
- query<T>() 반환값은 T[] (rows 래핑 없음)
  나쁜 예: const { rows } = await query(...)
  좋은 예: const results = await query<User>(...)

### Docker 빌드
- ARM64 서버이므로 --platform linux/arm64 불필요 (기본값)
  나쁜 예: docker build --platform linux/arm64 .
  좋은 예: docker build .

### 환경변수
- .env 파일 직접 읽기 금지, docker-compose.yml에서 주입
  나쁜 예: dotenv.config(); process.env.DB_PASSWORD
  좋은 예: process.env.DB_PASSWORD (이미 docker에서 주입됨)
```

### 전략 4: Memory 인덱스 최신화 규칙

메모리 시스템이 유용하려면 인덱스가 최신 상태여야 한다. 아래 트리거에서 MEMORY.md를 업데이트한다.

```
업데이트 트리거:
  - 프로젝트 완료 또는 MVP 달성
  - 중요한 기술 결정 확정
  - 실수 패턴 발견 (재발 방지)
  - 사용자 피드백 수렴

업데이트 하지 않을 것:
  - 일시적인 디버깅 메모
  - 이미 코드에 반영된 내용
  - 한 번만 쓰이는 명령어
```

---

## 7. harness-kit에서의 적용 방향

harness-kit은 이 계층 구조를 **검증하고 초기화**하는 도구를 제공한다.

```javascript
// harness-kit이 목표하는 API (개념)
import { initMemory, validateClaudeMd } from 'harness-kit/memory'

// CLAUDE.md 검증 (줄 수, 필수 섹션 존재 여부)
validateClaudeMd({
  path: './CLAUDE.md',
  maxLines: 200,
  requiredSections: ['Commands', 'Architecture', 'Conventions'],
  warnOnDuplicate: '~/.claude/CLAUDE.md'   // 글로벌과 중복 감지
})

// Memory 파일 초기화
initMemory({
  projectPath: '/home/ubuntu/my-project',
  template: 'web-service',   // 프리셋 템플릿
  outputDir: '~/.claude/projects/'
})
```

수동으로 관리하기 쉽게 놓치는 메모리 파일 frontmatter 오류, CLAUDE.md 비대화, 중복 규칙 등을 자동으로 감지할 수 있다.

---

## 참고 문서

- `~/.claude/CLAUDE.md` — 실제 글로벌 설정 파일
- `~/.claude/projects/-home-ubuntu/memory/MEMORY.md` — 실제 메모리 인덱스
- `/home/ubuntu/CLAUDE.md` — 루트 프로젝트 설정
- [05-agents-design.md](./05-agents-design.md) — 에이전트 시스템 설계
- [07-ecosystem-landscape.md](./07-ecosystem-landscape.md) — 경쟁 도구 비교
