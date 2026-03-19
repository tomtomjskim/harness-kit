# MCP 서버 조합 패턴

> Model Context Protocol(MCP)은 에이전트와 외부 도구를 표준화된 방식으로 연결하는 프로토콜이다. 어떤 MCP 서버를 어떻게 조합하느냐가 에이전트의 능력을 결정한다.

## 목차

1. [MCP란 무엇인가](#mcp란-무엇인가)
2. [3가지 트랜스포트](#3가지-트랜스포트)
3. [settings.json 설정 구조](#settingsjson-설정-구조)
4. [설정 범위: 글로벌 vs 프로젝트](#설정-범위-글로벌-vs-프로젝트)
5. [대표 MCP 서버 분석](#대표-mcp-서버-분석)
6. [프로젝트 유형별 추천 MCP 조합](#프로젝트-유형별-추천-mcp-조합)
7. [MCP 보안 주의사항](#mcp-보안-주의사항)
8. [claude mcp CLI 명령](#claude-mcp-cli-명령)
9. [참고 자료](#참고-자료)

---

## MCP란 무엇인가

### 배경: 도구 통합의 파편화 문제

LLM 에이전트마다 외부 도구(파일 시스템, DB, API, 브라우저 등)를 연결하는 방법이 달랐다. 각 에이전트 프레임워크가 자체 플러그인 시스템을 만들었고, 같은 기능(예: PostgreSQL 조회)을 각 프레임워크에 맞게 다시 구현해야 했다.

### MCP의 해결 방법

Anthropic이 2024년 발표한 **Model Context Protocol(MCP)**은 에이전트-도구 통신을 표준화한다:

```
[에이전트] ←─ MCP 프로토콜 ─→ [MCP 서버] ←─ 네이티브 API ─→ [외부 도구]
              (표준 JSON-RPC)                                   (DB, API, FS...)
```

MCP가 표준화하는 것:
- **Resources**: 파일, DB 레코드 등 데이터 단위 (컨텍스트에 포함)
- **Tools**: 에이전트가 호출할 수 있는 함수 (코드 실행)
- **Prompts**: 재사용 가능한 프롬프트 템플릿

### 핵심 가치

```
Before MCP:
  Claude + PostgreSQL → 커스텀 통합 필요
  GPT + PostgreSQL    → 또 다른 커스텀 통합
  Gemini + PostgreSQL → 또 다른 커스텀 통합

After MCP:
  postgres-mcp 서버 1개 → 모든 MCP 지원 에이전트에서 동작
```

---

## 3가지 트랜스포트

MCP 서버가 클라이언트(에이전트)와 통신하는 3가지 방법:

### 1. stdio (표준 입출력) — 로컬 프로세스

```
Claude Code ─── stdin/stdout ─── MCP 서버 프로세스 (로컬)
```

특징:
- 로컬 머신에서 실행
- 프로세스 간 통신 (가장 빠름)
- 네트워크 불필요

설정:
```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "serena", "serena-mcp-server"],
      "env": {
        "PROJECT_ROOT": "/home/ubuntu/project"
      }
    }
  }
}
```

### 2. HTTP (Streamable HTTP) — 원격 서버

```
Claude Code ─── HTTP POST ─── MCP 서버 (원격, HTTPS)
```

특징:
- 원격 서버에서 운영
- 인증 가능 (API 키, OAuth)
- 팀 공유 가능

설정:
```json
{
  "mcpServers": {
    "my-company-tools": {
      "url": "https://mcp.mycompany.com/v1",
      "headers": {
        "Authorization": "Bearer ${MY_COMPANY_API_KEY}"
      }
    }
  }
}
```

### 3. SSE (Server-Sent Events) — 구형 방식

HTTP의 이전 버전. 새 프로젝트에서는 HTTP 트랜스포트 사용 권장.

```json
{
  "mcpServers": {
    "legacy-server": {
      "url": "https://legacy-mcp.example.com/sse"
    }
  }
}
```

### 트랜스포트 선택 기준

| 상황 | 권장 트랜스포트 |
|------|----------------|
| 로컬 도구 (DB, 파일 시스템) | stdio |
| 팀 공유 도구 | HTTP |
| 외부 SaaS 통합 | HTTP |
| 기존 레거시 서버 | SSE |

---

## settings.json 설정 구조

```json
{
  "mcpServers": {
    "서버명": {
      // stdio 트랜스포트
      "command": "실행_명령",        // 필수 (stdio용)
      "args": ["인수1", "인수2"],    // 선택
      "env": {                       // 선택: 환경변수
        "KEY": "value"
      },

      // HTTP 트랜스포트
      "url": "https://...",          // 필수 (HTTP용)
      "headers": {                   // 선택: HTTP 헤더
        "Authorization": "Bearer ..."
      }
    }
  }
}
```

### 환경변수 참조

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
        //                               ↑ 셸 환경변수 참조
      }
    }
  }
}
```

환경변수는 `.env` 파일이 아닌 **셸 환경**에서 읽힌다. `export GITHUB_TOKEN=...` 또는 `settings.local.json`에 직접 값 입력.

---

## 설정 범위: 글로벌 vs 프로젝트

### 글로벌 MCP (`~/.claude/settings.json`)

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "serena", "serena-mcp-server"]
    }
  }
}
```

- **적용 범위**: 모든 프로젝트
- **권장 용도**: 개인 도구, 범용 분석 도구 (serena, playwright 등)

### 프로젝트 MCP (`.claude/settings.json`)

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://appuser:pwd@172.20.0.20:5432/maindb"
      }
    }
  }
}
```

- **적용 범위**: 해당 프로젝트만
- **권장 용도**: 프로젝트 전용 DB, API 서버 연결

### 전략적 분리

```
글로벌 (~/.claude/settings.json):
  serena     — 모든 프로젝트에서 코드 분석
  playwright — 모든 프로젝트에서 브라우저 테스트

프로젝트 A (.claude/settings.json):
  postgres-mcp — 프로젝트 A DB 접근
  github       — 프로젝트 A 리포지토리

프로젝트 B (.claude/settings.json):
  mysql-mcp    — 프로젝트 B DB 접근 (다른 DB)
  jira         — 프로젝트 B 이슈 트래커
```

---

## 대표 MCP 서버 분석

### 1. serena — 시맨틱 코드 분석

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "serena", "serena-mcp-server"],
      "env": {
        "SERENA_PROJECT_ROOT": "${workspaceFolder}",
        "SERENA_LANGUAGE_SERVER": "auto"
      }
    }
  }
}
```

**제공 도구**:

| 도구 | 설명 | 사용 예 |
|------|------|---------|
| `find_symbol` | 심볼(클래스, 함수) 위치 찾기 | "UserService 클래스 어디 있어?" |
| `get_symbols_overview` | 파일의 심볼 구조 파악 | "auth.ts의 구조 보여줘" |
| `find_referencing_symbols` | 특정 심볼을 참조하는 곳 찾기 | "이 함수 누가 호출해?" |
| `replace_symbol_body` | 함수/클래스 본문 교체 | "calculateTotal 함수 수정해" |
| `search_for_pattern` | 정규식으로 코드 패턴 검색 | "모든 SQL 쿼리 찾아줘" |
| `replace_content` | 정규식으로 내용 치환 | "foo 변수명을 bar로 전부 바꿔" |

**왜 Grep/Read 대신 serena인가**:

```
# Grep 방식 — 텍스트 기반
"UserService 찾아" → 정규식 매칭 → 텍스트 라인 반환
문제: 동명의 변수, 주석, 문자열까지 다 나옴

# serena 방식 — 심볼 기반
"UserService 찾아" → AST 분석 → 정확한 심볼 위치 반환
장점: 정확한 클래스/함수만, 메서드 목록 포함, 리팩토링 안전
```

**실제 활용 패턴**:

```
대규모 리팩토링:
1. find_symbol("UserService", depth=2)  → 클래스 + 메서드 목록
2. find_referencing_symbols("UserService")  → 영향 범위 파악
3. replace_symbol_body("UserService/login")  → 안전하게 수정
```

---

### 2. shadcn — UI 컴포넌트 검색

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["-y", "@shadcn/mcp-server"]
    }
  }
}
```

**제공 도구**:

| 도구 | 설명 |
|------|------|
| `search_components` | 컴포넌트 검색 (키워드) |
| `get_component_docs` | 컴포넌트 문서 + 예시 코드 |
| `get_component_source` | 컴포넌트 소스 코드 |

**활용 예**:

```
"달력 UI 만들어줘"
→ shadcn.search_components("calendar")
→ Calendar 컴포넌트 발견
→ shadcn.get_component_docs("calendar")
→ 설치 방법 + 예시 코드 반환
→ Claude가 프로젝트에 맞게 구현
```

---

### 3. playwright — 브라우저 자동화

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**제공 도구**:

| 도구 | 설명 |
|------|------|
| `browser_navigate` | URL 이동 |
| `browser_screenshot` | 스크린샷 |
| `browser_click` | 엘리먼트 클릭 |
| `browser_fill` | 폼 입력 |
| `browser_evaluate` | JavaScript 실행 |

**활용 예**:

```
"로그인 페이지 E2E 테스트 작성해줘"
→ playwright.browser_navigate("http://localhost:3000/login")
→ playwright.browser_screenshot()  ← 현재 상태 확인
→ playwright.browser_fill("#email", "test@example.com")
→ playwright.browser_click("[type=submit]")
→ playwright.browser_screenshot()  ← 결과 확인
→ 실제 동작 기반으로 테스트 코드 생성
```

---

### 4. github-mcp-server — GitHub 통합

```json
{
  "mcpServers": {
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

**제공 도구**:

| 도구 | 설명 |
|------|------|
| `create_issue` | 이슈 생성 |
| `create_pull_request` | PR 생성 |
| `list_issues` | 이슈 목록 |
| `get_file_contents` | 파일 내용 읽기 |
| `search_code` | 코드 검색 |

**활용 예**:

```
"현재 작업한 내용으로 PR 만들어줘"
→ github.create_pull_request({
    title: "feat: 사용자 인증 구현",
    body: "## 변경 사항\n...",
    base: "main", head: "feature/auth"
  })
→ PR URL 반환
```

---

### 5. postgres-mcp — PostgreSQL 접근

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://appuser:password@localhost:5432/mydb"
      }
    }
  }
}
```

**제공 도구**:

| 도구 | 설명 |
|------|------|
| `query` | SQL 쿼리 실행 |
| `list_tables` | 테이블 목록 |
| `describe_table` | 테이블 스키마 |

**활용 예**:

```
"users 테이블 구조 파악하고 관련 API 만들어줘"
→ postgres-mcp.list_tables()
→ postgres-mcp.describe_table("users")
→ 스키마 기반으로 TypeScript 타입 + API 코드 생성
```

**보안 주의**: 읽기 전용 DB 사용자 권한 권장

```sql
-- 읽기 전용 사용자 생성
CREATE USER claude_reader WITH PASSWORD 'secure_pwd';
GRANT CONNECT ON DATABASE mydb TO claude_reader;
GRANT USAGE ON SCHEMA public TO claude_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_reader;
```

---

## 프로젝트 유형별 추천 MCP 조합

### 풀스택 웹 (Next.js / Nuxt / SvelteKit)

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "serena", "serena-mcp-server"]
    },
    "shadcn": {
      "command": "npx",
      "args": ["-y", "@shadcn/mcp-server"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

| MCP | 역할 |
|-----|------|
| serena | 코드베이스 분석, 심볼 기반 리팩토링 |
| shadcn | UI 컴포넌트 검색 및 구현 가이드 |
| playwright | 기능 개발 후 즉시 E2E 검증 |

**워크플로우**:
```
새 기능 개발
→ serena: 기존 코드 구조 파악
→ shadcn: UI 컴포넌트 선택
→ 코드 구현
→ playwright: E2E 테스트 실행
```

---

### API 서버 (Express / FastAPI / NestJS)

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "serena", "serena-mcp-server"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

| MCP | 역할 |
|-----|------|
| serena | API 엔드포인트 구조 분석, 서비스 레이어 리팩토링 |
| github | PR 생성, 이슈 연동 |
| postgres-mcp | 스키마 탐색, 쿼리 최적화 |

**워크플로우**:
```
이슈 기반 개발
→ github: 이슈 내용 읽기
→ postgres-mcp: 관련 테이블 스키마 파악
→ serena: 영향받는 서비스 코드 분석
→ 구현
→ github: PR 생성
```

---

### 데이터 파이프라인 (Python / DBT / Airflow)

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
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

**워크플로우**:
```
데이터 모델 변경
→ postgres-mcp: 현재 스키마 + 데이터 샘플 확인
→ 마이그레이션 스크립트 작성
→ postgres-mcp: 쿼리 실행 결과 검증
→ github: PR 생성
```

---

## MCP 보안 주의사항

### 원칙 1: 최소 권한 (Least Privilege)

```json
// 나쁜 예: 전체 권한
"env": {
  "DATABASE_URL": "postgresql://admin:password@db:5432/prod"
  //               admin 사용자: 테이블 삭제, 사용자 생성 가능
}

// 좋은 예: 읽기 전용
"env": {
  "DATABASE_URL": "postgresql://claude_reader:pwd@db:5432/prod"
  //               SELECT만 가능한 전용 사용자
}
```

### 원칙 2: API 키는 secrets에

```json
// 나쁜 예: settings.json에 직접 입력 (git에 커밋될 수 있음)
{
  "env": {
    "GITHUB_TOKEN": "ghp_xxxxxxxxxxxx"
  }
}

// 좋은 예: settings.local.json (gitignore) 또는 셸 환경변수
// settings.local.json:
{
  "env": {
    "GITHUB_TOKEN": "ghp_xxxxxxxxxxxx"
  }
}
// .gitignore에 .claude/settings.local.json 추가
```

### 원칙 3: 도구 권한 제한

```json
{
  "permissions": {
    "allow": [
      "mcp__postgres-mcp__query",          // query만 허용
      "mcp__postgres-mcp__list_tables",    // 조회 도구만
      "mcp__postgres-mcp__describe_table"
    ],
    "deny": [
      "mcp__postgres-mcp__*"
      // 위의 allow보다 deny가 우선순위 낮으므로
      // 이 패턴은 작동 안 함 — allow 목록만 사용하는 것이 더 안전
    ]
  }
}
```

### 원칙 4: 민감 데이터 접근 제어

```sql
-- 특정 컬럼 숨기기 (PostgreSQL View 활용)
CREATE VIEW users_safe AS
  SELECT id, username, email, created_at
  -- password_hash, phone, ssn 등 민감 컬럼 제외
  FROM users;

GRANT SELECT ON users_safe TO claude_reader;
-- users 테이블 직접 접근 권한은 부여하지 않음
```

### 원칙 5: 프로덕션 환경 분리

```json
// .claude/settings.json (공유 설정 — DB URL 미포함)
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"  // 셸 환경변수로
      }
    }
  }
}

// 개발 환경에서 실행:
// export DATABASE_URL="postgresql://dev_user:pwd@localhost/devdb"

// 절대로:
// export DATABASE_URL="postgresql://admin:pwd@prod.db.com/proddb"
```

---

## claude mcp CLI 명령

### 서버 추가

```bash
# stdio 서버 추가 (글로벌)
claude mcp add serena \
  --command uvx \
  --args "--from,serena,serena-mcp-server"

# 환경변수와 함께
claude mcp add postgres-mcp \
  --command npx \
  --args "-y,@modelcontextprotocol/server-postgres" \
  --env "DATABASE_URL=postgresql://localhost/mydb"

# HTTP 서버 추가
claude mcp add my-remote-server \
  --url "https://mcp.example.com/v1"

# 프로젝트 범위로 추가 (--scope project)
claude mcp add --scope project postgres-mcp \
  --command npx \
  --args "-y,@modelcontextprotocol/server-postgres"
```

### 서버 목록 조회

```bash
# 모든 MCP 서버 목록
claude mcp list

# 출력 예:
# serena     stdio  uvx --from serena serena-mcp-server
# github     stdio  npx -y @modelcontextprotocol/server-github
# playwright stdio  npx -y @playwright/mcp@latest
```

### 서버 상세 정보

```bash
claude mcp get serena

# 출력:
# Name: serena
# Transport: stdio
# Command: uvx
# Args: --from serena serena-mcp-server
# Status: connected
# Tools: find_symbol, get_symbols_overview, ...
```

### 서버 제거

```bash
claude mcp remove serena

# 프로젝트 범위 서버 제거
claude mcp remove --scope project postgres-mcp
```

### 서버 상태 확인

```bash
# 서버 연결 테스트
claude mcp ping serena

# 서버가 제공하는 도구 목록 확인
claude mcp tools serena
```

---

## 참고 자료

- [Model Context Protocol 공식 사이트](https://modelcontextprotocol.io/) — 스펙, 서버 목록, SDK
- [MCP 서버 레지스트리](https://github.com/modelcontextprotocol/servers) — 공식 서버 목록
- [Claude Code MCP 설정 가이드](https://docs.anthropic.com/claude/docs/claude-code/mcp) — Claude Code 전용 설정 문서
- [serena GitHub](https://github.com/oraios/serena) — 시맨틱 코드 분석 MCP 서버
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector) — MCP 서버 디버깅 도구
