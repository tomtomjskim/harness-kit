# 하네스 엔지니어링이란 무엇인가

> LLM을 CPU로, 컨텍스트 윈도우를 RAM으로, 개발자가 작성하는 설정을 OS로 본다 — Martin Fowler 비유를 확장한 컨텍스트 엔지니어링의 실천 방법론.

## 목차

1. [왜 "하네스"인가](#왜-하네스인가)
2. [Prompt Engineering vs Context Engineering](#prompt-engineering-vs-context-engineering)
3. [Codified Context: 논문 기반 이론 배경](#codified-context-논문-기반-이론-배경)
4. [하네스의 5대 구성 요소](#하네스의-5대-구성-요소)
5. [모듈화가 필요한 이유](#모듈화가-필요한-이유)
6. [참고 자료](#참고-자료)

---

## 왜 "하네스"인가

**하네스(harness)**는 원래 말이나 동물에게 씌우는 마구(馬具)를 뜻한다. 엔지니어링에서는 "복잡한 시스템을 안전하고 제어 가능하게 묶어두는 구조"를 의미한다.

LLM 에이전트에서 하네스는 다음 역할을 한다:

- **통제**: 에이전트가 의도치 않은 행동을 하지 못하도록 경계 설정
- **증폭**: 에이전트가 올바른 컨텍스트를 가지고 최선의 결정을 내리도록 지원
- **재현성**: 어떤 프로젝트에서도, 어떤 팀원이 실행해도 동일한 동작 보장

Martin Fowler는 이렇게 비유했다:

> "LLM은 CPU다. 컨텍스트 윈도우는 RAM이다. 그리고 개발자가 작성하는 모든 설정 — CLAUDE.md, hooks, agents — 은 OS다."

CPU(LLM)는 바꾸기 어렵다. RAM(컨텍스트)은 한계가 있다. 그러나 **OS(하네스)는 우리가 직접 설계한다**. 하네스 엔지니어링이란 이 OS를 잘 설계하는 일이다.

---

## Prompt Engineering vs Context Engineering

### Prompt Engineering (프롬프트 엔지니어링)

단일 요청에서 LLM의 응답 품질을 높이는 기법. 주로 **런타임 입력**에 집중한다.

```
"당신은 시니어 개발자입니다. 다음 코드를 리뷰해주세요:
[코드]
다음 형식으로 답해주세요:
1. 버그
2. 성능
3. 가독성"
```

한계:
- 매 대화마다 반복 작성 필요
- 팀 간 공유 어려움
- 에이전트 워크플로우에서 단계 간 일관성 유지 불가

### Context Engineering (컨텍스트 엔지니어링)

에이전트가 **항상** 올바른 정보와 제약을 가지도록 **사전에 설계**하는 방법론.

```
프롬프트 엔지니어링: "이번 대화에서 이렇게 행동해"
컨텍스트 엔지니어링: "이 프로젝트에서 항상 이렇게 행동해"
```

컨텍스트 엔지니어링의 관심 대상:

| 계층 | 무엇을 | 어떻게 |
|------|--------|--------|
| 정적 컨텍스트 | 프로젝트 규칙, 팀 컨벤션 | CLAUDE.md |
| 동적 컨텍스트 | 현재 작업, 이전 결정 | Memory, Tasks |
| 도구 컨텍스트 | 사용 가능한 도구 목록 | MCP, permissions |
| 행동 컨텍스트 | 허용/차단 작업 | Hooks, settings |
| 역할 컨텍스트 | 특화된 전문가 페르소나 | Agents |

### 실질적 차이

```
# 프롬프트 엔지니어링 방식
사용자: "TypeScript strict mode 켜줘, 항상 async/await 써줘,
         커밋 전에 lint 돌려줘, ..."  ← 매번 반복

# 컨텍스트 엔지니어링 방식
CLAUDE.md:
  - TypeScript strict mode 필수
  - async/await 우선 (Promise chain 지양)
hooks.json:
  - PreToolUse(Bash): 커밋 전 lint 자동 실행
→ 사용자는 아무 말 안 해도 됨
```

---

## Codified Context: 논문 기반 이론 배경

**arXiv:2602.20478** — "Codified Context: Formalizing Context Engineering for LLM Agents"

이 논문은 컨텍스트를 두 가지 메모리 유형으로 분류한다:

### Hot Memory (핫 메모리)

에이전트의 활성 컨텍스트 윈도우 안에 있는 정보.

- **특징**: 즉시 접근 가능, 용량 제한 있음, 세션 종료 시 소멸
- **예시**: 현재 대화 내용, 방금 읽은 파일, 최근 도구 실행 결과
- **관리**: 중요한 내용을 요약해 Cold Memory로 이전

```
[Hot Memory 예시]
현재 컨텍스트:
- 사용자가 auth.ts 수정 요청
- auth.ts 파일 읽음 (250줄)
- 관련 테스트 파일 읽음
- JWT 토큰 검증 로직 파악
→ 이 모든 것이 컨텍스트 윈도우 소비
```

### Cold Memory (콜드 메모리)

컨텍스트 윈도우 밖에 있지만 필요 시 로드 가능한 정보.

- **특징**: 무제한 용량, 접근 시 컨텍스트 소비, 세션 간 지속
- **예시**: CLAUDE.md, agent 파일, skills, 외부 DB
- **관리**: 구조화된 파일로 저장, 필요 시만 로드

```
[Cold Memory 예시]
~/.claude/CLAUDE.md          ← 글로벌 규칙
.claude/CLAUDE.md            ← 프로젝트 규칙
.claude/agents/reviewer.md   ← 리뷰어 에이전트 정의
→ 필요할 때만 컨텍스트로 로드
```

### Codified Context의 핵심 주장

1. **컨텍스트는 코드처럼 관리되어야 한다**: 버전 관리, 테스트, 모듈화
2. **Hot/Cold 전환 전략이 성능을 결정한다**: 무엇을 항상 로드하고 무엇을 필요 시 로드할지
3. **컨텍스트 설계는 아키텍처 결정이다**: 시스템 전체 품질에 영향

---

## 하네스의 5대 구성 요소

Claude Code 기준으로 하네스는 다음 5가지로 구성된다:

### 1. Instructions (인스트럭션)

**"에이전트에게 무엇을 알려줄 것인가"**

```
CLAUDE.md (마크다운 자유형)
├── 프로젝트 개요
├── 기술 스택 및 아키텍처
├── 코딩 컨벤션
├── 금지 행동 목록
└── 팀 특수 규칙
```

특징:
- 자유형 마크다운 — 구조 강제 없음
- 글로벌(`~/.claude/CLAUDE.md`) + 프로젝트(`.claude/CLAUDE.md`) 계층
- 서브디렉토리마다 별도 CLAUDE.md 가능 (해당 디렉토리 작업 시 자동 로드)

### 2. Settings (세팅)

**"에이전트가 무엇을 할 수 있는가"**

```json
// .claude/settings.json
{
  "permissions": {
    "allow": ["Bash(npm run *)", "Read(**)", "Edit(src/**)"],
    "deny": ["Bash(rm -rf *)", "Bash(git push --force *)"]
  },
  "env": {
    "NODE_ENV": "development"
  }
}
```

특징:
- 도구별 세밀한 허용/차단
- 환경 변수 주입
- 모델 선택, 언어 설정

### 3. Hooks (훅)

**"이벤트 발생 시 무조건 실행되는 코드"**

```json
// .claude/hooks.json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "npx prettier --write $CLAUDE_FILE_PATH"
      }]
    }]
  }
}
```

특징:
- LLM 판단 없이 **결정론적** 실행
- 17개 라이프사이클 이벤트
- 보안 게이트, 자동 포매터, 알림 등에 사용

### 4. Skills (스킬)

**"특정 작업을 수행하는 재사용 가능한 능력 패킷"**

```
.claude/skills/
└── code-review/
    ├── SKILL.md        ← 스킬 정의 + 트리거 조건
    ├── checklist.md    ← 리뷰 체크리스트
    └── examples/       ← 예시 파일
```

특징:
- Progressive Disclosure Architecture: 필요 시에만 상세 내용 로드
- 자동 활성화 조건 정의 가능
- 플러그인으로 배포 가능

### 5. Agents (에이전트)

**"특화된 역할을 가진 서브에이전트"**

```markdown
---
name: security-reviewer
description: 보안 취약점 전문 리뷰어. 인증/인가, SQL 인젝션, XSS 검사.
model: claude-opus-4-5
tools: Read, Grep, Glob
---

당신은 시니어 보안 엔지니어입니다.
코드를 검토할 때 항상 공격자의 관점에서 생각합니다...
```

특징:
- YAML frontmatter: 이름, 설명, 모델, 허용 도구
- 마크다운 본문: 역할, 행동 지침
- 오케스트레이터가 `Task()` 도구로 호출

---

## 모듈화가 필요한 이유

### 문제 1: 중복과 불일치

팀에 개발자 5명이 있다면, 각자 머릿속에 "우리 팀 규칙"이 다르게 저장되어 있다. LLM에게 매번 다르게 설명한다.

```
개발자 A: "우리는 TypeScript strict 써"
개발자 B: "에러 처리는 항상 try-catch야"
개발자 C: "커밋 메시지는 한국어야"
→ 각자의 AI가 다른 코드를 생성
```

**해결**: 팀 공유 CLAUDE.md → 모든 AI가 동일한 컨텍스트

### 문제 2: 반복 작업

```
매 프로젝트마다:
- "이 프로젝트는 Next.js야" 설명
- "Docker로 배포해" 설명
- "환경변수는 .env 읽어" 설명
→ 수십 번 반복
```

**해결**: 프로젝트별 CLAUDE.md → 한 번 작성, 영구 적용

### 문제 3: 재사용 불가

A 프로젝트에서 만든 훌륭한 코드 리뷰 프로세스를 B 프로젝트에 그대로 가져갈 방법이 없다.

**해결**: Skills + Plugins → 패키지처럼 설치

### 문제 4: 보안과 안전

LLM이 실수로 `rm -rf /`를 실행하거나 프로덕션 DB를 수정할 수 있다.

**해결**: Hooks + Permissions → 결정론적 차단

### 모듈화의 실제 효과

```
[Before: 모듈화 없음]
새 프로젝트 시작 → 개발자가 30분간 프롬프트 작성
팀원 합류 → 규칙 문서 읽고 각자 AI에 반복 입력
규칙 변경 → 모든 팀원이 각자 업데이트

[After: 하네스 모듈화]
새 프로젝트 시작 → CLAUDE.md 복사 + 수정 (5분)
팀원 합류 → git pull 한 번
규칙 변경 → CLAUDE.md 수정 → PR → 모두 적용
```

---

## 참고 자료

- [arXiv:2602.20478](https://arxiv.org/abs/2602.20478) — Codified Context: Formalizing Context Engineering for LLM Agents
- [Martin Fowler's Bliki: LLM-as-OS Analogy](https://martinfowler.com/bliki/) — LLM/컨텍스트/OS 비유 출처
- [Claude Code Documentation](https://docs.anthropic.com/claude/docs/claude-code) — 공식 설정 문서
- [Context Engineering vs Prompt Engineering](https://www.philschmid.de/context-engineering) — Phil Schmid의 상세 비교
