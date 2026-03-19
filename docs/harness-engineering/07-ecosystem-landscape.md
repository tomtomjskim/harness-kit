# 07. 경쟁 도구 비교 및 생태계 현황

> Phase 0 학습 문서 | 기준: 2026년 3월 | 대상 독자: harness-kit 포지셔닝 이해가 필요한 기여자

---

## 1. AI 코딩 에이전트 설정 도구 비교표

아래는 2026년 3월 기준 GitHub에서 확인 가능한 주요 도구들이다.

| 도구 | Stars | 주간 DL | 지원 에이전트 | 핵심 기능 | 상태 |
|------|------:|-------:|:---:|----------|------|
| **Ruler** | 2,563 | 11,000 | 34개 | 멀티 에이전트 규칙 파일 생성, CLI | Beta v0.3.x |
| **ai-rulez** | 94 | 453 | 18개 프리셋 | 컨텍스트 압축, YAML 기반 규칙 | Stable |
| **block/ai-rules** | 80 | - | 11개 | Block(Square) 공식 에이전트 규칙 | Stable |
| **rule-porter** | 31 | - | - | 규칙 파일 포맷 변환 (이식성) | Alpha |
| **ai-rules-sync** | 18 | - | - | 팀 간 규칙 동기화, git-based | Alpha |
| **ai-nexus** | 12 | - | - | 규칙 레지스트리, 공유 허브 | PoC |
| **rulesync** | 8 | - | - | 모노레포 규칙 일관성 유지 | Alpha |

### Ruler (2,563 stars)

현재 가장 널리 사용되는 도구다.

```bash
# 설치
npm install -g ruler-ai

# 프로젝트 초기화 (34개 에이전트 프리셋 중 선택)
ruler init --agents claude,cursor,copilot

# 규칙 생성
ruler generate --preset fullstack-typescript

# 생성 결과
.cursorrules         ← Cursor용
CLAUDE.md            ← Claude Code용
.github/copilot-instructions.md  ← GitHub Copilot용
```

```yaml
# ruler.config.yaml 예시
agents:
  - claude
  - cursor
  - copilot

rules:
  language: typescript
  framework: nextjs
  style: strict
  testing: jest+playwright

custom:
  - "모든 API 응답은 { ok, data, error } 형식"
  - "Docker 환경에서만 실행, .env 직접 읽기 금지"
```

**장점**: 멀티 에이전트 동기화, 풍부한 프리셋 (34개), 활성화된 커뮤니티
**한계**: 텍스트 파일 생성에 집중. hooks, settings.json, MCP, memory는 미지원

### ai-rulez (94 stars)

컨텍스트 압축에 특화된 도구다.

```yaml
# .ai-rulez.yaml
presets:
  - name: backend-python
    compress: true      # 중복 제거, 압축
    agents:
      claude: rules/claude-backend.md
      cursor: rules/cursor-backend.md

custom_rules:
  - category: database
    rule: "Raw SQL 금지, ORM 사용 필수"
  - category: security
    rule: "환경변수는 절대 로깅 금지"
```

```bash
ai-rulez generate --compress --output .claude/
# 컨텍스트 토큰 절약률 통계 출력
# Compressed 847 lines → 234 lines (72% reduction)
```

**장점**: 컨텍스트 효율성, YAML 기반 구조화
**한계**: 18개 프리셋 한정, 고급 Claude Code 기능 미지원

### block/ai-rules

Block(구 Square)의 공식 AI 규칙 파일 모음이다.

```
block/ai-rules/
├── claude/
│   ├── CLAUDE.md          ← Claude Code 규칙
│   └── agents/
│       ├── backend.md
│       └── frontend.md
├── cursor/
│   └── .cursorrules
└── README.md
```

**특징**: 대기업 실전 경험 반영, 보안/컴플라이언스 중심
**한계**: Block 내부 스택 특화 (Go, TypeScript), 범용화 미흡

### 기타 도구 요약

```
rule-porter:  .cursorrules → CLAUDE.md → AGENTS.md 포맷 변환
              포맷 마이그레이션용, 자체 기능 없음

ai-rules-sync: git 기반으로 팀 전체 규칙 파일 동기화
               monorepo 환경에서 일관성 유지

ai-nexus:     공개 규칙 레지스트리 (npmjs처럼 규칙 검색/설치)
              "npm install ai-rules/django-rest" 같은 개념

rulesync:     monorepo 패키지 간 규칙 충돌 감지 및 병합
```

---

## 2. 각 도구가 커버하는 영역 vs 커버하지 못하는 영역

### 기능 매트릭스

| 기능 | Ruler | ai-rulez | block/ai-rules | rule-porter | harness-kit (목표) |
|------|:---:|:---:|:---:|:---:|:---:|
| CLAUDE.md 생성 | O | O | O | O | O |
| 멀티 에이전트 동기화 | O | O | O | O | O |
| agents/*.md 생성 | - | - | - | - | **O** |
| hooks 관리 | - | - | - | - | **O** |
| settings.json 관리 | - | - | - | - | **O** |
| MCP 서버 설정 | - | - | - | - | **O** |
| Memory 파일 관리 | - | - | - | - | **O** |
| Team workflows | - | - | - | - | **O** |
| 검증/린트 | 부분 | - | - | - | **O** |
| 설정 diff/마이그레이션 | - | - | - | O | **O** |

### 모든 도구가 커버하는 영역

현재 모든 도구가 공통으로 제공하는 기능은 두 가지다.

**1. 텍스트 규칙 파일 생성**

```bash
# 모든 도구의 공통 출력물
CLAUDE.md                          # Claude Code
.cursorrules                       # Cursor
.github/copilot-instructions.md    # GitHub Copilot
AGENTS.md                          # OpenAI Codex, Gemini CLI
```

이 파일들은 단순 텍스트 마크다운이다. 도구들은 이 파일을 만들기 위한 CLI/설정 레이어를 제공한다.

**2. 멀티 에이전트 동기화**

```bash
# 하나의 소스에서 여러 에이전트 포맷으로 내보내기
ruler sync  → claude, cursor, copilot 동시 업데이트
ai-rulez generate --all  → 모든 등록 에이전트 갱신
```

### 모든 도구가 미커버하는 영역

기존 도구들이 전혀 다루지 않는 영역이다.

**1. hooks (`.claude/settings.json` hooks 섹션)**

```json
// 아무 도구도 이 파일을 관리하지 않는다
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "bash /scripts/validate-command.sh"
      }]
    }],
    "PostToolUse": [{
      "matcher": "Write",
      "hooks": [{
        "type": "command",
        "command": "bash /scripts/notify-write.sh"
      }]
    }]
  }
}
```

**2. settings.json (도구 권한, 환경변수)**

```json
// 개발자가 수동으로 관리하는 파일
{
  "permissions": {
    "allow": ["Bash(git *)", "Bash(npm run *)"],
    "deny": ["Bash(rm -rf *)", "Bash(git push --force *)"]
  },
  "env": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

**3. Memory 파일 관리**

```
~/.claude/projects/*/memory/
├── MEMORY.md        # 아무 도구도 이 파일을 생성/검증하지 않음
└── *.md             # 개별 메모리 파일 관리 도구 없음
```

**4. Team Workflows (YAML DAG)**

```yaml
# ~/.claude/team/workflows/code-review.yaml
# 아무 도구도 이 레이어를 다루지 않는다
phases:
  automated:
    parallel: true
    tasks:
      - id: security_scan
        agent: security-reviewer
        condition: always
```

**5. Subagents (agents/*.md)**

```
~/.claude/agents/
# 모든 기존 도구는 CLAUDE.md만 생성
# agents/ 디렉토리의 subagent 파일은 아무도 관리하지 않음
```

---

## 3. 업계 표준 수렴 트렌드

### AGENTS.md: Linux Foundation AAIF 표준

```
표준 이름: AGENTS.md
주도 기관: Linux Foundation - AI & Automation Interoperability Foundation (AAIF)
채택 현황: 60,000+ GitHub 프로젝트, 146개 기업

내용 범위:
  - 에이전트가 접근할 수 있는 도구 선언
  - 코드베이스 탐색 힌트
  - 제약사항 (접근 금지 경로, 사용 금지 명령)

호환 도구:
  - OpenAI Codex
  - Google Gemini CLI
  - Anthropic Claude Code (CLAUDE.md로 지원)
  - Cursor (partial)
```

```markdown
# AGENTS.md 예시 (AAIF 표준)

## Tools
This agent has access to:
- read_file, write_file, execute_bash
- web_search (read-only)

## Repository Structure
- src/ — 소스 코드 (읽기/쓰기 가능)
- tests/ — 테스트 파일 (읽기/쓰기 가능)
- .env — 절대 접근 금지

## Constraints
- Never commit directly to main branch
- Always run tests before committing
- Do not install packages without approval
```

### SKILL.md: Anthropic 주도 스킬 시스템

```
표준 이름: SKILL.md (Skill Definition File)
주도 기관: Anthropic
상태: Claude Code에서 플러그인 시스템으로 구현

구조:
  name: skill-name
  version: "1.0.0"
  description: 스킬 설명
  triggers:
    - /command-name
  workflow:
    - step1
    - step2

호환 도구:
  - Claude Code (Superpowers 플러그인으로 구현)
  - OpenAI Codex (논의 중)
  - Gemini CLI (검토 중)
```

```yaml
# ~/.claude/plugins/superpowers/skills/tdd.yaml
name: tdd
version: "1.0.0"
description: Test-Driven Development 워크플로우
triggers:
  - /superpowers:tdd
workflow:
  - phase: red
    instruction: "실패하는 테스트 먼저 작성"
  - phase: green
    instruction: "테스트를 통과하는 최소 코드 작성"
  - phase: refactor
    instruction: "코드 품질 개선 (테스트 유지)"
```

### MCP (Model Context Protocol): 도구 통합 사실상 표준

```
표준 이름: MCP (Model Context Protocol)
주도 기관: Anthropic (오픈 표준으로 공개)
채택 현황: 사실상 업계 표준으로 수렴 중

핵심 개념:
  - AI 모델이 외부 도구를 호출하는 표준 인터페이스
  - 서버(도구 제공) ↔ 클라이언트(Claude Code) 분리
  - 언어 무관 (TypeScript, Python, Go 구현 모두 존재)

주요 MCP 서버:
  - mcp-serena: 코드 심볼 분석
  - mcp-github: GitHub API 통합
  - mcp-postgres: PostgreSQL 직접 쿼리
  - mcp-filesystem: 파일시스템 작업
  - mcp-shadcn: shadcn/ui 컴포넌트 가이드
```

```json
// ~/.claude/claude_desktop_config.json (MCP 설정)
{
  "mcpServers": {
    "serena": {
      "command": "python",
      "args": ["-m", "serena.mcp_server"],
      "env": {
        "PROJECT_ROOT": "/home/ubuntu"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### 표준 수렴 방향 요약

```
2024년 이전: 에이전트별 독자 포맷 (카오스)
  Cursor → .cursorrules
  Claude → CLAUDE.md (없음, 사용자 임시방편)
  Copilot → .github/copilot-instructions.md

2025년: 수렴 시작
  AGENTS.md → 공통 기반 표준 (AAIF)
  MCP → 도구 통합 표준 (사실상 확정)
  SKILL.md → 스킬 공유 표준 (Anthropic 주도)

2026년: 표준화 가속
  60K+ 프로젝트가 AGENTS.md 채택
  MCP 서버 레지스트리 성장 (500+ 공개 서버)
  Claude Code hooks → CI/CD 통합 표준 논의 중
```

---

## 4. harness-kit의 포지셔닝

### 블루오션: "Claude Code 전용 하네스 프레임워크"

기존 도구들이 커버하는 영역과 harness-kit이 커버하는 영역을 명확히 구분한다.

```
기존 도구 (Ruler, ai-rulez 등)
  목표: 텍스트 규칙 파일 관리
  범위: CLAUDE.md, .cursorrules 등 마크다운 파일
  접근: 프리셋 + 커스텀 규칙 → 파일 생성

harness-kit (새로운 영역)
  목표: Claude Code 전체 설정 계층 프로그래매틱 관리
  범위: hooks + MCP + agents + settings + memory + workflows
  접근: 모듈화된 설정 코드 → 검증 → 배포
```

### 기능 영역별 포지셔닝

```
CLAUDE.md 생성
  기존: Ruler, ai-rulez ← 이미 잘 한다
  harness-kit: 기존 도구와 통합 또는 경쟁하지 않음
               대신 "CLAUDE.md 검증/린트" 레이어 제공

agents/*.md 관리
  기존: 아무 도구도 없음
  harness-kit: 에이전트 생성/업데이트/검증 전담

hooks 시스템
  기존: 아무 도구도 없음
  harness-kit: PreToolUse/PostToolUse 훅 모듈화

settings.json 관리
  기존: 아무 도구도 없음
  harness-kit: 도구 권한 프리셋, 환경별 프로파일

Memory 관리
  기존: 아무 도구도 없음
  harness-kit: 메모리 파일 초기화, 인덱스 검증

Team Workflows
  기존: 아무 도구도 없음
  harness-kit: 워크플로우 YAML 생성/검증/실행
```

### 타겟 사용자 및 Use Case

**Use Case 1: 새 프로젝트 부트스트랩**

```bash
# 기존 방법: 14개 파일 수동 복사+수정 (30분+)
cp -r ~/.claude/agents/ ./new-project/.claude/agents/
vim ./new-project/.claude/agents/developer.md
# ...반복

# harness-kit 방법 (목표)
npx harness-kit init \
  --template web-service \
  --stack nextjs-postgres \
  --agents developer,security-reviewer,dba \
  --output .claude/

# 결과: 14개 에이전트 파일, hooks, settings, workflows 일괄 생성 (2분)
```

**Use Case 2: 팀 설정 동기화**

```bash
# 팀 전체가 동일한 에이전트 설정 사용
# harness-kit.config.ts (팀 공유 파일)
export default {
  agents: {
    source: 'https://registry.harness-kit.dev/teams/jsnwcorp-v2',
    override: {
      'developer': { model: 'sonnet' }
    }
  },
  hooks: {
    'PreToolUse:Bash': './scripts/validate-bash.sh'
  }
}

# 각 개발자 머신에서
npx harness-kit sync  # 팀 표준으로 동기화
```

**Use Case 3: 설정 검증**

```bash
# CI/CD에서 설정 일관성 검증
npx harness-kit validate

# 출력 예시:
# ✓ agents/*.md — 14개 파일 모두 유효한 frontmatter
# ✓ settings.json — 권한 충돌 없음
# ✗ MEMORY.md — 200줄 초과 (현재 247줄)
# ✗ developer.md — 쓰기 도구 없이 Edit 사용 시도 (권한 불일치)
# ✗ code-review.yaml — Phase 3이 Phase 2에 depends_on 누락
```

### 경쟁 우위 요약

| 차별점 | 설명 |
|--------|------|
| Claude Code 전용 | 범용 멀티 에이전트 도구가 아닌, Claude Code 생태계 깊숙이 통합 |
| 프로그래매틱 접근 | 텍스트 편집이 아닌 코드(TypeScript)로 설정 정의 → 타입 안전성, 재사용 |
| 검증 레이어 | 설정 오류를 배포 전에 감지 (권한 불일치, 순환 의존성, 크기 초과) |
| 전체 계층 커버 | hooks + MCP + agents + settings + memory + workflows 통합 관리 |
| 기존 도구 호환 | Ruler/ai-rulez 출력물을 harness-kit으로 import 가능 (rule-porter 역할 통합) |

---

## 5. 생태계 참여 전략

harness-kit이 생태계에서 자리잡기 위한 전략적 방향이다.

### 표준 준수: AGENTS.md + MCP 호환

```
harness-kit 출력물은 반드시 업계 표준과 호환:
  - AGENTS.md 포맷 지원 (Claude Code 외 에이전트도 읽을 수 있게)
  - MCP 서버 설정 생성 지원
  - SKILL.md 연동 (Superpowers 플러그인과 통합)
```

### 점진적 채택 경로

```
1단계: Drop-in replacement
  - 기존 수동 설정을 harness-kit으로 가져오기
  - "지금 당장 효과" 제공 (검증만 해도 가치)

2단계: 팀 표준화
  - harness-kit.config.ts를 팀 레포에 커밋
  - CI에서 harness-kit validate 실행

3단계: 레지스트리 참여
  - 팀 에이전트 설정을 레지스트리에 공유
  - 커뮤니티 에이전트 프리셋 가져오기
```

### 오픈소스 전략

```
공개 목표:
  - Claude Code 사용자가 설정 관리로 시간 낭비하는 문제 해결
  - "Claude Code를 팀 도구로 쓰려면 harness-kit" 포지션

레지스트리 계획:
  - 공개 에이전트 프리셋 (보안, 성능, 접근성 리뷰어 등)
  - 스택별 워크플로우 템플릿 (nextjs, fastapi, django 등)
  - hooks 레시피 모음
```

---

## 참고 자료

- [Ruler GitHub](https://github.com/intellectronica/ruler) — 2,563 stars, 주간 11K DL
- [ai-rulez GitHub](https://github.com/dyoshida-tc/ai-rulez) — 94 stars
- [block/ai-rules GitHub](https://github.com/block/ai-rules) — 80 stars
- [Linux Foundation AAIF](https://lfaidata.foundation/) — AGENTS.md 표준 주도
- [MCP Specification](https://modelcontextprotocol.io/) — Model Context Protocol 공식 문서
- [Claude Code Documentation](https://docs.anthropic.com/claude-code) — hooks, agents, CLAUDE.md 공식 문서
- [05-agents-design.md](./05-agents-design.md) — 에이전트 시스템 설계
- [06-memory-system.md](./06-memory-system.md) — CLAUDE.md 계층 설계
