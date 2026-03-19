# Claude Code 설정 파일 전체 해부

> Claude Code의 동작을 제어하는 모든 파일의 구조, 역할, 우선순위를 완전히 이해한다.

## 목차

1. [전체 파일 계층 구조](#전체-파일-계층-구조)
2. [설정 우선순위](#설정-우선순위)
3. [CLAUDE.md 심층 분석](#claudemd-심층-분석)
4. [settings.json 전체 필드 참조](#settingsjson-전체-필드-참조)
5. [settings.local.json — 로컬 전용 설정](#settingslocaljson--로컬-전용-설정)
6. [agents/*.md — 서브에이전트 정의](#agentsmd--서브에이전트-정의)
7. [skills/ — 재사용 가능한 능력 패킷](#skills--재사용-가능한-능력-패킷)
8. [commands/*.md — 슬래시 커맨드](#commandsmd--슬래시-커맨드)
9. [plugins/ — 번들 패키지](#plugins--번들-패키지)
10. [실제 환경 예시 분석](#실제-환경-예시-분석)
11. [참고 자료](#참고-자료)

---

## 전체 파일 계층 구조

```
~/.claude/                          ← 글로벌 (모든 프로젝트에 적용)
├── CLAUDE.md                       ← 전역 인스트럭션
├── settings.json                   ← 전역 설정 (MCP, hooks, permissions)
├── agents/                         ← 전역 서브에이전트
│   ├── developer.md
│   ├── security-reviewer.md
│   └── ...
├── skills/                         ← 전역 스킬
│   └── code-review/
│       └── SKILL.md
├── commands/                       ← 전역 슬래시 커맨드
│   └── deploy.md
└── plugins/                        ← 설치된 플러그인
    └── superpowers/

<project-root>/
├── CLAUDE.md                       ← 프로젝트 인스트럭션
├── src/
│   └── CLAUDE.md                   ← 서브디렉토리 인스트럭션 (선택)
└── .claude/
    ├── settings.json               ← 프로젝트 설정
    ├── settings.local.json         ← 로컬 전용 설정 (gitignore 권장)
    ├── hooks.json                  ← 이벤트 훅 정의
    ├── agents/                     ← 프로젝트 전용 에이전트
    │   └── domain-expert.md
    ├── skills/                     ← 프로젝트 전용 스킬
    │   └── api-design/
    │       └── SKILL.md
    └── commands/                   ← 프로젝트 전용 슬래시 커맨드
        └── review-pr.md
```

### 핵심 원칙

- **글로벌 vs 프로젝트**: `~/.claude/`는 모든 프로젝트에, `.claude/`는 해당 프로젝트에만 적용
- **서브디렉토리 CLAUDE.md**: `src/components/CLAUDE.md`는 Claude가 `src/components/` 안에서 작업할 때 자동으로 로드
- **settings.local.json**: `.gitignore`에 추가 권장 — API 키, 개인 설정 포함 가능

---

## 설정 우선순위

Claude Code는 4계층 우선순위 시스템을 사용한다. 충돌 시 높은 우선순위가 낮은 우선순위를 덮어쓴다:

```
우선순위 (높음 → 낮음)
┌─────────────────────────────────────────┐
│ 1. Managed Policy                       │ ← 기업 관리자가 설정 (사용자 변경 불가)
├─────────────────────────────────────────┤
│ 2. Project Settings                     │ ← .claude/settings.json
│    + .claude/settings.local.json        │
├─────────────────────────────────────────┤
│ 3. User Settings                        │ ← ~/.claude/settings.json
├─────────────────────────────────────────┤
│ 4. Built-in Defaults                    │ ← Claude Code 기본값
└─────────────────────────────────────────┘
```

실제 동작 예시:

```json
// ~/.claude/settings.json (User)
{
  "permissions": {
    "deny": ["Bash(rm -rf *)"]
  }
}

// .claude/settings.json (Project)
{
  "permissions": {
    "allow": ["Bash(npm run *)"],
    "deny": ["Bash(git push --force *)"]
  }
}

// 최종 적용 결과:
// deny: ["Bash(rm -rf *)", "Bash(git push --force *)"]  ← 병합
// allow: ["Bash(npm run *)"]
```

---

## CLAUDE.md 심층 분석

### 기본 특성

- **형식**: 자유형 마크다운 (구조 강제 없음)
- **권장 길이**: 200줄 이내 (너무 길면 컨텍스트 낭비)
- **인코딩**: UTF-8
- **로드 시점**: Claude Code 세션 시작 시, 해당 디렉토리 작업 시

### 효과적인 CLAUDE.md 구조

```markdown
# 프로젝트명

## 개요
한 문단으로 프로젝트 목적과 기술 스택 요약.

## 아키텍처
서비스 구조, 주요 컴포넌트, 데이터 흐름.

## 개발 환경
- Node.js 20 LTS
- Docker 필수
- 환경변수: .env (절대 커밋 금지)

## 코딩 컨벤션
- TypeScript strict mode 필수
- 함수명: camelCase, 컴포넌트: PascalCase
- 에러 처리: try/catch + 로깅 필수

## 금지 사항
- `rm -rf` 명령 단독 실행 금지
- production DB 직접 쿼리 금지
- .env 파일 커밋 절대 금지

## 자주 쓰는 명령
- 개발 서버: `npm run dev`
- 빌드: `npm run build`
- 테스트: `npm test`

## 참고 문서
- API 스펙: docs/api.md
- DB 스키마: docs/schema.md
```

### 서브디렉토리 CLAUDE.md 활용

```
프로젝트/
├── CLAUDE.md                    ← "이 프로젝트는 Next.js야"
├── src/
│   ├── components/
│   │   └── CLAUDE.md            ← "컴포넌트는 Shadcn 기반, 접근성 필수"
│   └── api/
│       └── CLAUDE.md            ← "API는 REST, 인증은 JWT Bearer"
└── scripts/
    └── CLAUDE.md                ← "이 폴더는 관리자 전용 스크립트"
```

Claude가 `src/components/Button.tsx`를 수정할 때:
1. 프로젝트 루트 `CLAUDE.md` 로드
2. `src/components/CLAUDE.md` 로드
3. 두 컨텍스트를 합쳐서 작업

### 자주 하는 실수

```markdown
# 나쁜 예 — 너무 장황함
이 프로젝트는 2024년에 시작된 TypeScript 기반 웹 애플리케이션으로,
사용자들이 로그인하여 대시보드를 볼 수 있는 SaaS 플랫폼입니다.
초기에는 Vue.js로 시작했으나 팀 논의 후 React로 전환하였으며...
(100줄의 역사 설명)

# 좋은 예 — 간결하고 행동 중심
## 기술 스택
- Next.js 15 App Router (Pages Router 사용 금지)
- TypeScript strict (any 타입 금지)
- Tailwind CSS (인라인 style 금지)
- PostgreSQL — Drizzle ORM

## 필수 규칙
- 컴포넌트마다 JSDoc 주석 필수
- Server Component 기본, Client Component는 'use client' 명시
- 에러: never throw string, 항상 Error 객체
```

---

## settings.json 전체 필드 참조

```json
{
  // 언어 설정
  "language": "ko",

  // 모델 설정
  "model": "claude-opus-4-5",

  // 응답 품질/속도 trade-off
  "effortLevel": "high",  // "low" | "medium" | "high"

  // 권한 제어
  "permissions": {
    "allow": [
      "Read(**)",                    // 모든 파일 읽기
      "Edit(src/**)",                // src 하위만 편집
      "Bash(npm run *)",             // npm run 명령만
      "Bash(git commit *)",          // git commit만 (push 제외)
      "mcp__serena__*"               // serena MCP 전체 허용
    ],
    "deny": [
      "Bash(rm -rf *)",              // rm -rf 완전 차단
      "Bash(git push --force *)",    // force push 차단
      "Edit(.env*)",                 // .env 편집 차단
      "Bash(curl * | bash)"          // pipe to bash 차단
    ]
  },

  // 환경 변수 주입
  "env": {
    "NODE_ENV": "development",
    "DATABASE_URL": "postgresql://localhost:5432/devdb"
  },

  // MCP 서버 설정
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "serena", "serena-mcp-server"],
      "env": {
        "SERENA_PROJECT_ROOT": "${workspaceFolder}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  },

  // 훅 설정 (hooks.json 분리도 가능)
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write $CLAUDE_FILE_PATH",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

### permissions 패턴 문법

```
도구명(글로브패턴)

Read(src/**)           → src 하위 모든 파일 읽기
Edit(*.ts)             → TypeScript 파일만 편집
Bash(git *)            → git 모든 서브커맨드 허용
Bash(npm run {dev,build,test})  → 특정 npm 스크립트만
mcp__서버명__도구명    → 특정 MCP 도구
mcp__serena__*         → serena MCP 전체
```

---

## settings.local.json — 로컬 전용 설정

팀 공유 `settings.json`과 달리, 개인 로컬 환경에만 적용되는 설정.

```json
// .claude/settings.local.json (gitignore 권장)
{
  "permissions": {
    "allow": [
      "Bash(ssh *)",                 // 개인 서버 접근
      "Bash(kubectl *)"              // 개인 k8s 클러스터
    ]
  },
  "env": {
    "PERSONAL_API_KEY": "sk-..."     // 개인 API 키 (절대 커밋 금지)
  }
}
```

`.gitignore`에 추가:
```
.claude/settings.local.json
```

---

## agents/*.md — 서브에이전트 정의

### 파일 구조

```markdown
---
name: security-reviewer
description: >
  보안 취약점 전문 리뷰어.
  인증/인가, SQL 인젝션, XSS, CSRF, 민감 데이터 노출 검사.
  "공격자에게 노출되면?" 관점에서 코드를 분석한다.
model: claude-opus-4-5
tools:
  - Read
  - Grep
  - Glob
  - mcp__serena__find_symbol
  - mcp__serena__search_for_pattern
---

# 보안 리뷰어

당신은 시니어 보안 엔지니어입니다. 10년간 금융 시스템 보안을 담당했으며,
항상 공격자의 관점에서 코드를 검토합니다.

## 리뷰 체크리스트

### 인증/인가
- [ ] JWT 토큰 검증이 모든 엔드포인트에 적용되었는가
- [ ] 권한 확인이 프론트엔드가 아닌 서버에서 이루어지는가
- [ ] 세션 타임아웃이 적절한가

### 입력 검증
- [ ] SQL 쿼리에 파라미터 바인딩이 사용되는가 (문자열 연결 금지)
- [ ] XSS 방지를 위한 출력 이스케이프가 되어 있는가
- [ ] 파일 업로드 시 확장자/MIME 타입 검증이 있는가
```

### YAML frontmatter 필드 전체

```yaml
---
name: agent-id          # 필수: 고유 식별자 (kebab-case)
description: |          # 필수: 오케스트레이터가 이 에이전트를 언제 사용할지 결정하는 설명
  한 줄 이상 가능.
  구체적으로 작성할수록 올바른 상황에서 호출됨.
model: claude-sonnet-4-6  # 선택: 기본값은 현재 사용 중인 모델
tools:                  # 선택: 허용할 도구 목록 (미지정 시 전체 허용)
  - Read
  - Edit
  - Bash
  - Glob
  - Grep
  - mcp__serena__*
color: green            # 선택: UI 색상 (blue/green/red/yellow/purple/orange/pink/cyan)
---
```

### 에이전트 호출 방법

```
# 오케스트레이터 (Claude Code)가 자동 선택:
"이 코드의 보안을 검토해줘"
→ description 분석 → security-reviewer 자동 호출

# 명시적 호출 (사용자):
"security-reviewer 에이전트로 auth.ts 검토해줘"

# 프로그래매틱 호출 (에이전트 내부):
Task(security-reviewer, "src/auth.ts 보안 검토")
```

---

## skills/ — 재사용 가능한 능력 패킷

### 디렉토리 구조

```
.claude/skills/
└── api-design/
    ├── SKILL.md              ← 스킬 정의 (필수)
    ├── openapi-template.yaml ← 참조 파일
    ├── examples/
    │   ├── good-api.md
    │   └── bad-api.md
    └── checklist.md
```

### SKILL.md 구조

```markdown
---
name: api-design
description: RESTful API 설계 스킬. 리소스 명명, 버전 관리, 에러 응답 표준화.
triggers:
  - "API 설계"
  - "엔드포인트 추가"
  - "REST API"
autoActivate: false     # true면 트리거 키워드 감지 시 자동 로드
---

# API 설계 스킬

## Progressive Disclosure Architecture

이 스킬은 3단계로 구성됩니다:

### Level 1: 핵심 원칙 (항상 로드)
- 리소스는 명사, 동작은 HTTP 메서드로
- URL에 동사 금지: `/getUser` X → `/users/:id` O
- 복수형 사용: `/user` X → `/users` O

### Level 2: 표준 패턴 (요청 시 로드)
→ [openapi-template.yaml](./openapi-template.yaml) 참조

### Level 3: 심화 예시 (심층 작업 시)
→ [examples/](./examples/) 디렉토리 참조
```

### Progressive Disclosure Architecture

스킬이 무조건 모든 내용을 컨텍스트에 로드하면 낭비가 발생한다. 이를 해결하는 3단계 설계:

```
Level 1: 핵심 규칙 요약 (항상 컨텍스트에 있음)
  ↓ 필요하면
Level 2: 상세 가이드라인 + 패턴 (온디맨드 로드)
  ↓ 필요하면
Level 3: 전체 예시 + 엣지케이스 (심층 작업 시)
```

---

## commands/*.md — 슬래시 커맨드

사용자 정의 슬래시 커맨드. `/커맨드명`으로 실행.

```markdown
<!-- .claude/commands/review-pr.md -->
---
name: review-pr
description: PR 코드 리뷰. 변경된 파일을 분석하고 피드백을 제공한다.
---

다음 단계로 PR을 리뷰하세요:

1. `git diff main...HEAD`로 변경 사항 확인
2. 변경된 파일 각각에 대해:
   - 로직 오류 검사
   - 성능 이슈 검사
   - 보안 취약점 검사
3. 결과를 다음 형식으로 출력:
   ## PR 리뷰 결과
   ### 치명적 문제
   ### 개선 권장
   ### 칭찬할 점
```

사용:
```
사용자: /review-pr
→ Claude가 commands/review-pr.md 내용을 프롬프트로 실행
```

---

## plugins/ — 번들 패키지

플러그인은 skills + hooks + commands + MCP 설정을 하나의 패키지로 묶은 것.

```
~/.claude/plugins/
└── superpowers/
    ├── plugin.json           ← 플러그인 메타데이터
    ├── skills/
    │   ├── tdd/
    │   │   └── SKILL.md
    │   └── debugging/
    │       └── SKILL.md
    ├── commands/
    │   ├── brainstorm.md
    │   └── write-plan.md
    └── hooks/
        └── auto-test.json
```

```json
// plugin.json
{
  "name": "superpowers",
  "version": "4.2.0",
  "description": "14개 스킬 워크플로우 패키지",
  "skills": ["tdd", "debugging", "code-review"],
  "commands": ["brainstorm", "write-plan", "execute-plan"],
  "hooks": ["auto-test"]
}
```

---

## 실제 환경 예시 분석

현재 이 서버(`/home/ubuntu`)의 Claude Code 환경을 분석하면:

### 글로벌 설정 (`~/.claude/`)

```
~/.claude/
├── CLAUDE.md              ← 멀티 에이전트 팀 설정, 서버 아키텍처 문서
├── settings.json          ← MCP 서버 (serena), 글로벌 권한
├── team/
│   ├── agents.yaml        ← 15개 에이전트 정의 (v2.0)
│   ├── prompts/           ← 15개 상세 프롬프트 파일
│   └── workflows/         ← standard, quick-fix, refactor 등
├── agents/                ← 14개 공식 서브에이전트 파일
└── plugins/
    └── superpowers/       ← 4.2.0, 14개 스킬 워크플로우
```

### 프로젝트별 설정 예시 (`projects/lotto-master/.claude/`)

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(docker compose *)"
    ],
    "deny": [
      "Bash(docker exec * psql * -c *DELETE*)",
      "Bash(git push --force *)"
    ]
  },
  "mcpServers": {
    "postgres-mcp": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://appuser:password@172.20.0.20:5432/maindb"
      }
    }
  }
}
```

### 설정 계층이 최종적으로 만들어내는 동작

```
Claude Code 실행
  │
  ├── 글로벌 settings.json 로드 (serena MCP 활성화)
  ├── 글로벌 CLAUDE.md 로드 (서버 아키텍처, 팀 규칙)
  │
  ├── 프로젝트 .claude/settings.json 로드 (프로젝트 권한 병합)
  ├── 프로젝트 CLAUDE.md 로드 (프로젝트 특수 규칙)
  │
  └── 현재 작업 디렉토리 CLAUDE.md 로드 (서브디렉토리 규칙)
      └── 세션 시작
```

---

## 참고 자료

- [Claude Code Settings Reference](https://docs.anthropic.com/claude/docs/claude-code/settings) — 공식 settings.json 스키마
- [Claude Code Hooks Documentation](https://docs.anthropic.com/claude/docs/claude-code/hooks) — 훅 이벤트 전체 목록
- [Claude Code Sub-agents](https://docs.anthropic.com/claude/docs/claude-code/sub-agents) — 에이전트 frontmatter 스펙
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCP 공식 문서
