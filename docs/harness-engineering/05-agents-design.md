# 05. 멀티에이전트 설계 패턴

> Phase 0 학습 문서 | 대상 독자: harness-kit 기여자, Claude Code 고급 사용자

---

## 1. Claude Code 에이전트 시스템 개요

Claude Code는 `~/.claude/agents/` 디렉토리에 마크다운 파일을 배치하면 해당 파일이 **서브에이전트(subagent)**로 등록된다. 메인 에이전트(Claude Code)가 `Task()` 도구를 호출할 때 이 등록된 서브에이전트 중 하나를 선택하여 독립 컨텍스트에서 실행한다.

```
~/.claude/agents/
├── architect.md          # 시스템 설계 전문가
├── developer.md          # 코드 구현 담당
├── explorer.md           # 코드 탐색 전문가
├── qa-engineer.md        # 테스트/검증
├── dba.md                # DB 관리
├── publisher.md          # 빌드/배포
├── documenter.md         # 문서화
├── security-reviewer.md  # 보안 전문 리뷰어
├── performance-reviewer.md
├── test-coverage-reviewer.md
├── accessibility-reviewer.md
├── ux-reviewer.md
└── api-reviewer.md
```

각 파일은 두 부분으로 구성된다.

1. **YAML frontmatter**: 에이전트 메타데이터 및 도구 권한 선언
2. **마크다운 본문**: 에이전트 페르소나, 역할, 행동 지침 요약

---

## 2. Frontmatter 스키마

모든 에이전트 파일은 아래 스키마를 따른다.

```yaml
---
name: <string>          # 에이전트 식별자 (kebab-case)
description: <string>   # 한 줄 설명 (Claude가 선택 기준으로 사용)
model: sonnet | haiku | opus
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Edit                # 쓰기 에이전트만
  - Write               # 쓰기 에이전트만
  - mcp__serena__*      # Serena MCP 도구 (세분화)
---
```

### 실제 예시: developer.md

```yaml
---
name: developer
description: 시니어 개발자 - 코드 구현, 프론트엔드/백엔드 개발
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Bash
  - mcp__serena__find_symbol
  - mcp__serena__replace_symbol_body
  - mcp__serena__replace_content
  - mcp__serena__insert_after_symbol
  - mcp__serena__rename_symbol
  - mcp__serena__search_for_pattern
---
```

### 실제 예시: security-reviewer.md (읽기 전용)

```yaml
---
name: security-reviewer
description: 보안 전문 코드 리뷰어 - OWASP Top 10, 인증/인가, 취약점 분석
model: sonnet
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__serena__find_symbol
  - mcp__serena__find_referencing_symbols
  - mcp__serena__search_for_pattern
  - mcp__serena__get_symbols_overview
---
```

`Edit`, `Write`, `replace_symbol_body` 등 쓰기 도구가 없다는 점에 주목하라. 리뷰어는 읽고 분석만 한다.

---

## 3. 도구 권한의 최소 권한 원칙 (Least Privilege)

에이전트에게 필요한 도구만 선언하는 것이 핵심이다. 불필요한 쓰기 권한은 의도치 않은 파일 수정 위험을 초래한다.

### 읽기 전용 에이전트 (Readonly Agents)

분석·리뷰·탐색 에이전트에 적합하다.

```yaml
tools:
  # 파일 읽기
  - Read
  - Glob
  - Grep
  - Bash           # 읽기 전용 명령 실행 (ls, cat, git log 등)

  # Serena read-only 도구만
  - mcp__serena__find_symbol
  - mcp__serena__find_referencing_symbols
  - mcp__serena__get_symbols_overview
  - mcp__serena__search_for_pattern
  # mcp__serena__list_dir  # 탐색 에이전트에만 추가
```

해당 에이전트: `explorer`, `architect`, `security-reviewer`, `performance-reviewer`, `test-coverage-reviewer`, `accessibility-reviewer`, `ux-reviewer`, `api-reviewer`

### 쓰기 에이전트 (Write Agents)

코드 생성·수정·배포 에이전트에 적합하다.

```yaml
tools:
  # 읽기 (상속)
  - Read
  - Glob
  - Grep
  - Bash

  # 쓰기 추가
  - Edit
  - Write

  # Serena 쓰기 도구 추가
  - mcp__serena__replace_symbol_body
  - mcp__serena__replace_content
  - mcp__serena__insert_after_symbol
  - mcp__serena__rename_symbol
```

해당 에이전트: `developer`, `dba`, `publisher`, `documenter`

### 도구 권한 매트릭스

| 도구 | explorer | architect | reviewer | developer | dba | publisher |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Read/Glob/Grep | O | O | O | O | O | O |
| Bash | O | O | O | O | O | O |
| Edit/Write | - | - | - | O | O | O |
| serena read | O | O | O | O | O | O |
| serena write | - | - | - | O | O | - |
| serena list_dir | O | O | - | - | - | - |

---

## 4. 2-레이어 패턴: 등록 파일 + 행동 정의 파일

에이전트 파일을 단일 파일에 모든 정보를 담으면 유지보수가 어렵다. 현재 시스템은 **2-레이어 패턴**을 사용한다.

```
Layer 1: ~/.claude/agents/*.md
  역할: 에이전트 등록 + 간략한 역할 요약
  크기: ~30줄 이내
  내용: frontmatter + 핵심 역할 bullet + 상세 프롬프트 참조 경로

Layer 2: ~/.claude/team/prompts/*.md
  역할: 에이전트 행동 상세 정의
  크기: 제한 없음 (필요한 만큼)
  내용: 분석 방법론, 출력 포맷, 판단 기준, 예시
```

### Layer 1 예시 (agents/developer.md)

```markdown
---
name: developer
description: 시니어 개발자 - 코드 구현, 프론트엔드/백엔드 개발
model: sonnet
tools: [Read, Edit, Write, Glob, Grep, Bash, ...]
---

# Developer Agent

시니어 개발자로서 할당된 기능을 구현합니다.

## 핵심 역할
- Frontend: React, Next.js, TypeScript, Tailwind CSS
- Backend: Node.js, Python, FastAPI, Express

상세 프롬프트: `~/.claude/team/prompts/developer.md`
```

### Layer 2 예시 (team/prompts/developer.md)

```markdown
# Developer Agent - 상세 행동 정의

## 구현 전 체크리스트
1. 기존 코드 먼저 읽고 이해
2. 재사용 가능한 유틸리티/컴포넌트 탐색
3. 타입 정의 먼저 작성 (TypeScript)

## 코딩 표준
### TypeScript
- strict mode 필수 (`any` 사용 금지)
- 함수 반환 타입 명시
- interface > type alias (확장 가능성)

### React 패턴
- Server Component 기본, 클라이언트 상태 필요 시 'use client'
- ...

## 출력 형식
작업 완료 후 변경 파일 목록과 주요 결정 사항을 요약 출력.
```

이 패턴의 장점:
- Layer 1은 가볍게 유지 → Claude가 에이전트 선택 시 빠르게 읽음
- Layer 2는 상세 지침 → 실행 시 컨텍스트로 주입
- 두 레이어를 독립적으로 수정 가능

---

## 5. 역할 분리 패턴

### Core Agents (7종)

일반적인 소프트웨어 개발 라이프사이클을 커버하는 기본 에이전트 집합이다.

| 에이전트 | 타입 | 주요 책임 |
|---------|------|----------|
| `architect` | Plan | 아키텍처 설계, 기술 스택 결정 |
| `developer` | general-purpose | 코드 구현 (FE/BE) |
| `explorer` | Explore | 코드 탐색, 영향도 분석 |
| `qa-engineer` | general-purpose | 테스트 작성, 품질 검증 |
| `dba` | Bash | DB 스키마, 마이그레이션 |
| `publisher` | Bash | 빌드, 배포, Docker |
| `documenter` | general-purpose | 문서화, API docs |

### Specialist Reviewers (6종)

코드 리뷰 특화 에이전트. 각자 고유한 관점(perspective)을 가진다.

| 에이전트 | 페르소나 | 핵심 관점 |
|---------|---------|----------|
| `security-reviewer` | Security Sentinel | "공격자에게 노출되면?" |
| `performance-reviewer` | Performance Prophet | "트래픽 10배면?" |
| `test-coverage-reviewer` | Test Guardian | "이 테스트가 진짜 검증하나?" |
| `accessibility-reviewer` | Access Advocate | "장애인도 쓸 수 있나?" |
| `ux-reviewer` | UX Harmonizer | "사용자가 혼란스럽지 않나?" |
| `api-reviewer` | API Arbiter | "1년 후에도 호환되나?" |

---

## 6. 리뷰어 공통 패턴: Severity 4-레벨

모든 Specialist Reviewer는 동일한 심각도 분류 체계를 공유한다. 이 일관성 덕분에 PM이 여러 리뷰어의 결과를 종합할 때 비교 기준이 통일된다.

```markdown
## 심각도 분류

- **CRITICAL**: 즉시 배포 차단 필요
  예) SQL Injection, RCE, 하드코딩 시크릿, 장애 유발 메모리 누수

- **HIGH**: 수정 필수 (배포 전)
  예) XSS, CSRF, N+1 쿼리, 번들 50KB+ 증가, WCAG 위반

- **MEDIUM**: 계획적 수정 권장
  예) 과도한 CORS, 약한 해싱, 캐싱 미적용, 반응형 누락

- **LOW**: 선택적 개선
  예) 보안 헤더 누락, 최적화 기회, 스타일 일관성
```

### 리뷰어 Output Format 표준

```markdown
## [리뷰어명] Review

### Summary
- 변경사항 개요 (2-3줄)

### Findings

#### CRITICAL
- [ ] [파일:라인] 문제 설명
  - 위험: ...
  - 수정 방법: ...

#### HIGH
- [ ] ...

#### MEDIUM
- [ ] ...

#### LOW
- [ ] ...

### Verdict
APPROVED | APPROVED_WITH_COMMENTS | REQUEST_CHANGES | REJECTED
```

---

## 7. 조건부 실행 (Conditional Execution)

일부 리뷰어는 변경 유형에 따라 선택적으로 실행된다. 이는 불필요한 리뷰 실행을 막아 비용과 시간을 절약한다.

```yaml
# agents.yaml 에서의 condition 선언
accessibility-reviewer:
  condition: has_ui_changes   # UI 변경 시에만 실행

ux-reviewer:
  condition: has_ui_changes   # UI 변경 시에만 실행

api-reviewer:
  condition: has_api_changes  # API 변경 시에만 실행

dba:
  condition: has_db_changes   # DB 변경 시에만 실행
```

```yaml
# code-review.yaml 워크플로우에서의 condition 적용
- id: accessibility_review
  agent: accessibility-reviewer
  action: review_accessibility
  condition: has_ui_changes          # 조건 충족 시에만 태스크 실행
  description: "WCAG 2.1 AA, 키보드, 스크린리더, 색상 대비"
```

**조건 평가 방법**: PM 에이전트가 변경 파일 목록(`git diff --name-only`)을 분석하여 조건을 판단한다.

```
has_ui_changes  → *.tsx, *.jsx, *.css, *.html 파일 변경 여부
has_api_changes → routes/, controllers/, api/ 경로 파일 변경 여부
has_db_changes  → migrations/, *.sql, schema/ 파일 변경 여부
```

---

## 8. 워크플로우 통합: phases → tasks → agent

에이전트 단독 실행보다 **워크플로우(workflow)**와 통합할 때 진가가 발휘된다. 워크플로우는 YAML로 정의된 DAG(Directed Acyclic Graph)다.

```yaml
# 워크플로우 구조 패턴
phases:
  phase_name:
    name: "단계 설명"
    parallel: true | false      # 병렬 실행 여부
    depends_on: [prev_phase]    # 의존 단계 (체이닝)
    tasks:
      - id: task_id
        agent: agent-name       # 어떤 에이전트가 실행할지
        action: action_name
        condition: has_ui_changes   # 조건부 실행
        inputs:
          - previous_output.md  # 이전 태스크 출력을 입력으로
        outputs:
          - result.md
```

### depends_on 체이닝 예시

```
Phase 1: automated (병렬)
  ├── static_analysis  [qa]
  ├── security_scan    [security-reviewer]
  ├── test_coverage    [qa]
  └── complexity       [explorer]
         ↓ depends_on: [automated]
Phase 2: security_performance (병렬)
  ├── security_review  [security-reviewer]  ← security_scan.md 참조
  └── performance_review [performance-reviewer] ← complexity_report.md 참조
         ↓ depends_on: [security_performance]
Phase 3: architecture_api (병렬)
  ├── architecture_review [architect]
  └── api_review          [api-reviewer]   ← condition: has_api_changes
         ↓
Phase 6: verdict
  └── compile_review  [pm]  ← 모든 리뷰 종합
```

---

## 9. 실전 예시: code-review 워크플로우 (6단계, 3프리셋)

실제 운영 중인 `~/.claude/team/workflows/code-review.yaml`의 구조를 분석한다.

### 프리셋 시스템

단일 워크플로우가 세 가지 깊이로 실행된다.

```yaml
presets:
  quick:
    phases: [automated]               # 자동 분석만
    estimated_time: "~2분"
    use_case: "단순 수정, 설정 변경"

  standard:
    phases: [automated, security_performance, architecture_api, verdict]
    estimated_time: "~10분"
    use_case: "일반 기능 추가, 버그 수정"

  thorough:
    phases: [automated, security_performance, architecture_api,
             functional_ux, test_quality, verdict]
    estimated_time: "~20분"
    use_case: "중요 변경, 릴리즈 전, 보안 관련"
```

### 실행 모드: subagent vs agent_teams

```yaml
execution_mode:
  default: "subagent"
  modes:
    subagent:
      description: "PM이 Task()로 순차/병렬 스폰 (기본, 비용 효율)"
      max_parallel: 4

    agent_teams:
      description: "Agent Teams 모드 (최대 병렬, 독립 컨텍스트)"
      trigger: "팀 리뷰"
      teammate_config:
        - name: "T1-Security"
          roles: [security-reviewer]
        - name: "T2-Performance"
          roles: [performance-reviewer, dba]
        - name: "T3-Architecture"
          roles: [architect, api-reviewer]
        - name: "T4-Logic"
          roles: [developer, test-coverage-reviewer]
        - name: "T5-UX"
          roles: [accessibility-reviewer, ux-reviewer]
```

---

## 10. 팀 에이전트 정의: agents.yaml 구조

`~/.claude/team/agents.yaml`은 팀 전체 에이전트를 조직적으로 정의한다. 개별 `agents/*.md` 파일과 다른 점은 팀 맥락, 책임 범위, 출력물을 명시적으로 선언한다는 것이다.

```yaml
version: "2.0"
team_name: "jsnwcorp-dev-team"

agents:
  pm:
    name: "PM (Project Manager)"
    type: "orchestrator"
    can_spawn:              # PM이 생성 가능한 에이전트 목록
      - architect
      - developer
      - security-reviewer
      # ...

  security-reviewer:
    name: "Security Sentinel"
    type: "general-purpose"
    model: "sonnet"
    persona: "보안 전문 코드 리뷰어"
    perspective: "공격자에게 노출되면?"
    prompt: "prompts/security-reviewer.md"  # Layer 2 참조
    responsibilities:
      - OWASP Top 10 취약점 탐지
      - 인증/인가 로직 검증
    outputs:
      - security-review.md
    expertise:
      - owasp-top-10
      - authentication
      - secrets-management
```

### agents.yaml vs agents/*.md 비교

| 항목 | agents/*.md | agents.yaml |
|------|-------------|-------------|
| 역할 | Claude Code 에이전트 등록 | 팀 구성 관리 |
| 사용 주체 | Claude Code 런타임 | PM 에이전트, 워크플로우 |
| 포함 내용 | frontmatter + 간략 설명 | 상세 책임, 출력물, 조건 |
| 필수 여부 | 필수 (등록 없으면 못 씀) | 팀 시스템에서 필수 |

---

## 11. harness-kit에서의 적용 방향

harness-kit은 이 에이전트 시스템을 **프로그래매틱하게** 생성하고 관리하는 도구를 제공한다.

```javascript
// harness-kit이 목표하는 API (개념)
import { createAgent } from 'harness-kit/agents'

createAgent({
  name: 'security-reviewer',
  description: '보안 전문 코드 리뷰어',
  model: 'sonnet',
  permissions: 'readonly',      // readonly | readwrite | bash-only
  serena: 'readonly',           // Serena 도구 권한 레벨
  promptFile: 'prompts/security-reviewer.md',
  outputDir: '~/.claude/agents/'
})
```

수동으로 14개 파일을 일관되게 유지하는 대신, 설정 하나로 에이전트 파일을 생성·업데이트·검증할 수 있다.

---

## 참고 문서

- `~/.claude/agents/` — 실제 에이전트 파일 (14개)
- `~/.claude/team/agents.yaml` — 팀 에이전트 구성
- `~/.claude/team/workflows/code-review.yaml` — 코드 리뷰 워크플로우
- `~/.claude/team/prompts/` — 에이전트 상세 행동 정의
- [06-memory-system.md](./06-memory-system.md) — CLAUDE.md 계층 설계
