# Hooks 심화: 결정론적 자동화

> Hooks는 LLM의 판단을 거치지 않고 이벤트 발생 시 **무조건** 실행되는 코드다. 보안 게이트, 자동 포매터, 테스트 러너를 LLM에 의존하지 않고 구현하는 방법.

## 목차

1. [Hooks란 무엇인가](#hooks란-무엇인가)
2. [hooks.json 구조 완전 분석](#hooksjson-구조-완전-분석)
3. [17개 라이프사이클 이벤트](#17개-라이프사이클-이벤트)
4. [이벤트 데이터: stdin JSON](#이벤트-데이터-stdin-json)
5. [실전 유즈케이스 5선](#실전-유즈케이스-5선)
6. [고급 패턴](#고급-패턴)
7. [주의사항 및 트러블슈팅](#주의사항-및-트러블슈팅)
8. [참고 자료](#참고-자료)

---

## Hooks란 무엇인가

### LLM 의존 자동화의 문제

Claude에게 "파일 저장 후 항상 prettier를 실행해"라고 말할 수 있다. 하지만:

- LLM이 "이번에는 건너뛰어도 될 것 같은데?"라고 판단할 수 있다
- 에이전트 체인에서 서브에이전트가 이 지시를 모를 수 있다
- 지시를 까먹거나 다른 지시와 충돌할 수 있다

### Hooks의 철학: 결정론적 자동화

```
LLM 의존 자동화:
  이벤트 발생 → LLM이 판단 → "해야 하나?" → 실행 (불확실)

Hook 기반 자동화:
  이벤트 발생 → Hook 실행 → 완료 (100% 확실)
```

Hooks는 OS의 **인터럽트 핸들러**와 같다. CPU(LLM)가 무슨 생각을 하든 상관없이, 인터럽트가 발생하면 핸들러가 실행된다.

### 핵심 특성

1. **결정론적**: LLM 판단 없이 항상 실행
2. **동기적 기본값**: hook 완료 후 다음 단계 진행 (async 옵션 있음)
3. **차단 가능**: PreToolUse hook이 실패(exit code != 0)하면 도구 실행 차단
4. **stdin 통신**: 이벤트 데이터를 stdin JSON으로 수신

---

## hooks.json 구조 완전 분석

```json
{
  "hooks": {
    "이벤트명": [
      {
        "matcher": "도구명_정규식",    // 선택: 특정 도구에만 적용
        "hooks": [
          {
            "type": "command",         // 현재 "command"만 지원
            "command": "실행할_명령",  // 셸 명령
            "timeout": 30000,          // ms 단위, 기본값 60000 (60초)
            "async": false             // true면 비동기 실행 (결과 무관)
          }
        ]
      }
    ]
  }
}
```

### matcher 상세

```json
// matcher 없음 → 해당 이벤트 모든 경우에 실행
{
  "hooks": [{
    "type": "command",
    "command": "echo 'tool used'"
  }]
}

// matcher 있음 → 정규식으로 도구명 필터링
{
  "matcher": "Edit",
  "hooks": [{"type": "command", "command": "..."}]
}

// 여러 도구 매칭
{
  "matcher": "Edit|Write|MultiEdit",
  "hooks": [{"type": "command", "command": "..."}]
}

// Bash 중 특정 패턴
{
  "matcher": "Bash",
  "hooks": [{"type": "command", "command": "..."}]
  // 주의: Bash 명령 내용은 stdin JSON에서 확인해야 함
}
```

### 여러 hook 조합

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write $CLAUDE_FILE_PATH",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "npx eslint --fix $CLAUDE_FILE_PATH",
            "timeout": 15000
          }
        ]
      }
    ]
  }
}
```

훅은 배열 순서대로 순차 실행된다.

---

## 17개 라이프사이클 이벤트

### 도구 실행 관련

| 이벤트 | 타이밍 | 차단 가능 | 주요 용도 |
|--------|--------|-----------|-----------|
| `PreToolUse` | 도구 실행 직전 | 가능 (exit != 0) | 보안 게이트, 확인 프롬프트 |
| `PostToolUse` | 도구 실행 직후 | 불가 | 포매터, 테스트, 알림 |

### 세션 관련

| 이벤트 | 타이밍 | 차단 가능 | 주요 용도 |
|--------|--------|-----------|-----------|
| `SessionStart` | 세션 시작 | 불가 | 환경 초기화, 상태 로드 |
| `SessionStop` | 세션 종료 | 불가 | 정리 작업, 로그 저장 |

### 메시지 관련

| 이벤트 | 타이밍 | 차단 가능 | 주요 용도 |
|--------|--------|-----------|-----------|
| `UserPromptSubmit` | 사용자 메시지 제출 직후 | 불가 | 로깅, 메시지 전처리 |
| `Stop` | Claude 응답 완료 | 불가 | OS 알림, 요약 생성 |
| `Notification` | 시스템 알림 발생 | 불가 | 알림 릴레이 |

### 에이전트 관련

| 이벤트 | 타이밍 | 차단 가능 | 주요 용도 |
|--------|--------|-----------|-----------|
| `SubagentStop` | 서브에이전트 종료 | 불가 | 서브에이전트 결과 처리 |

### 컨텍스트 관련

| 이벤트 | 타이밍 | 차단 가능 | 주요 용도 |
|--------|--------|-----------|-----------|
| `PreCompact` | 컨텍스트 압축 직전 | 불가 | 중요 정보 백업 |

---

## 이벤트 데이터: stdin JSON

Hook 스크립트는 환경변수가 아닌 **stdin**으로 JSON 데이터를 수신한다.

### PreToolUse / PostToolUse 데이터

```json
{
  "session_id": "sess_abc123",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/home/ubuntu/project/src/app.ts",
    "old_string": "const foo = 1",
    "new_string": "const foo = 2"
  },
  "tool_response": {            // PostToolUse에만 있음
    "success": true,
    "content": "파일 수정 완료"
  }
}
```

### 환경 변수 (편의용)

일부 자주 쓰이는 값은 환경변수로도 제공된다:

```bash
$CLAUDE_SESSION_ID          # 현재 세션 ID
$CLAUDE_FILE_PATH           # 현재 작업 파일 경로 (Edit/Write 시)
$CLAUDE_TOOL_NAME           # 현재 도구명
```

### stdin JSON 파싱 예시

```bash
#!/bin/bash
# stdin에서 JSON 읽기
INPUT=$(cat)

# jq로 필드 추출
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

echo "Tool: $TOOL_NAME"
echo "File: $FILE_PATH"
```

```python
#!/usr/bin/env python3
import json
import sys

data = json.load(sys.stdin)
tool_name = data.get("tool_name")
file_path = data.get("tool_input", {}).get("file_path")

print(f"Tool: {tool_name}, File: {file_path}")
```

---

## 실전 유즈케이스 5선

### 유즈케이스 1: Security Gate — 위험 명령 차단

```json
// .claude/hooks.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/home/ubuntu/harness-kit/hooks/security-gate.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# hooks/security-gate.sh

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# 위험 패턴 목록
BLOCKED_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "dd if=/dev/zero"
  "mkfs"
  "> /dev/sda"
  "chmod -R 777 /"
  ":(){:|:&};:"    # Fork bomb
)

for PATTERN in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qF "$PATTERN"; then
    echo "BLOCKED: 위험한 명령이 감지되었습니다: $PATTERN" >&2
    exit 1  # exit 1 → Claude가 명령 실행 차단
  fi
done

# 민감 파일 접근 차단
SENSITIVE_FILES=(
  "/etc/passwd"
  "/etc/shadow"
  "~/.ssh/id_rsa"
  ".env"
)

for FILE in "${SENSITIVE_FILES[@]}"; do
  if echo "$COMMAND" | grep -q "$FILE"; then
    echo "BLOCKED: 민감 파일 접근이 차단되었습니다: $FILE" >&2
    exit 1
  fi
done

exit 0  # exit 0 → 명령 실행 허용
```

**동작 원리**: PreToolUse hook에서 exit code 1 반환 → Claude가 Bash 도구 실행 취소 → 에러 메시지를 컨텍스트에 추가

---

### 유즈케이스 2: Auto-formatter — 파일 저장 후 자동 포매팅

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node /home/ubuntu/harness-kit/hooks/auto-format.js",
            "timeout": 15000
          }
        ]
      }
    ]
  }
}
```

```javascript
// hooks/auto-format.js
const { execSync } = require('child_process');
const fs = require('fs');

const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const filePath = input.tool_input?.file_path;

if (!filePath || !fs.existsSync(filePath)) {
  process.exit(0);
}

const ext = filePath.split('.').pop();

const formatters = {
  // JavaScript/TypeScript
  'js': `npx prettier --write "${filePath}"`,
  'jsx': `npx prettier --write "${filePath}"`,
  'ts': `npx prettier --write "${filePath}" && npx eslint --fix "${filePath}"`,
  'tsx': `npx prettier --write "${filePath}" && npx eslint --fix "${filePath}"`,
  // Python
  'py': `python3 -m ruff format "${filePath}" && python3 -m ruff check --fix "${filePath}"`,
  // CSS
  'css': `npx prettier --write "${filePath}"`,
  'scss': `npx prettier --write "${filePath}"`,
};

const command = formatters[ext];
if (command) {
  try {
    execSync(command, { stdio: 'pipe' });
    console.log(`Formatted: ${filePath}`);
  } catch (err) {
    // 포매팅 실패는 경고로 처리 (차단 안 함)
    console.error(`Format warning: ${err.message}`);
  }
}

process.exit(0);  // 항상 0 반환 (PostToolUse는 차단 없음)
```

---

### 유즈케이스 3: Test Runner — 코드 변경 후 자동 테스트

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /home/ubuntu/harness-kit/hooks/smart-test-runner.py",
            "timeout": 60000,
            "async": false
          }
        ]
      }
    ]
  }
}
```

```python
#!/usr/bin/env python3
# hooks/smart-test-runner.py
import json
import subprocess
import sys
import os
from pathlib import Path

data = json.load(sys.stdin)
file_path = data.get("tool_input", {}).get("file_path", "")

if not file_path:
    sys.exit(0)

path = Path(file_path)

# 테스트 파일 자체는 스킵 (무한 루프 방지)
if "test" in path.name or "spec" in path.name:
    sys.exit(0)

# 파일 유형별 테스트 명령 결정
test_commands = {
    ".ts": f"npx jest --testPathPattern='{path.stem}' --passWithNoTests",
    ".tsx": f"npx jest --testPathPattern='{path.stem}' --passWithNoTests",
    ".py": f"python3 -m pytest tests/ -k '{path.stem}' -x -q 2>&1 | tail -20",
}

ext = path.suffix
cmd = test_commands.get(ext)

if not cmd:
    sys.exit(0)

# 프로젝트 루트 찾기 (package.json 또는 pyproject.toml)
project_root = path.parent
for _ in range(10):
    if (project_root / "package.json").exists() or (project_root / "pyproject.toml").exists():
        break
    project_root = project_root.parent

result = subprocess.run(
    cmd, shell=True, capture_output=True, text=True, cwd=project_root
)

if result.returncode != 0:
    print(f"테스트 실패 (수정된 파일: {path.name}):", file=sys.stderr)
    print(result.stdout[-2000:], file=sys.stderr)  # 마지막 2000자만
    # 참고: PostToolUse는 exit code와 무관하게 도구 실행 차단 불가
    # 하지만 Claude 컨텍스트에 에러 정보 전달됨
else:
    print(f"테스트 통과: {path.name}")

sys.exit(0)
```

---

### 유즈케이스 4: Commit Guard — 커밋 전 품질 검사

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash /home/ubuntu/harness-kit/hooks/commit-guard.sh",
            "timeout": 60000
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# hooks/commit-guard.sh

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# git commit 명령인지 확인
if ! echo "$COMMAND" | grep -q "^git commit"; then
  exit 0  # git commit이 아니면 통과
fi

echo "커밋 전 품질 검사 실행 중..."

# 1. TypeScript 타입 검사
if [ -f "tsconfig.json" ]; then
  echo "→ TypeScript 검사..."
  if ! npx tsc --noEmit 2>&1; then
    echo "BLOCKED: TypeScript 에러가 있습니다." >&2
    exit 1
  fi
fi

# 2. ESLint
if [ -f ".eslintrc*" ] || [ -f "eslint.config.*" ]; then
  echo "→ ESLint 검사..."
  if ! npx eslint src/ --max-warnings=0 2>&1 | tail -20; then
    echo "BLOCKED: ESLint 경고/에러가 있습니다." >&2
    exit 1
  fi
fi

# 3. 테스트 실행
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  echo "→ 테스트 실행..."
  if ! npm test -- --passWithNoTests 2>&1 | tail -30; then
    echo "BLOCKED: 테스트 실패." >&2
    exit 1
  fi
fi

echo "모든 검사 통과. 커밋 허용."
exit 0
```

---

### 유즈케이스 5: Notification — 작업 완료 시 OS 알림

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /home/ubuntu/harness-kit/hooks/notify-done.sh",
            "async": true,
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# hooks/notify-done.sh

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

# macOS
if command -v osascript &>/dev/null; then
  osascript -e 'display notification "Claude 작업 완료" with title "Claude Code"'
fi

# Linux (notify-send)
if command -v notify-send &>/dev/null; then
  notify-send "Claude Code" "작업 완료 (세션: $SESSION_ID)"
fi

# 터미널 벨
echo -e '\a'

# Slack Webhook (선택)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-type: application/json' \
    -d "{\"text\": \"Claude 작업 완료 :white_check_mark:\"}"
fi
```

---

## 고급 패턴

### 패턴 1: 조건부 차단 (사용자 확인 요청)

```bash
#!/bin/bash
# hooks/confirm-dangerous.sh
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE "DROP TABLE|TRUNCATE|DELETE FROM.*WHERE 1=1"; then
  echo "위험한 DB 명령이 감지되었습니다:" >&2
  echo "$COMMAND" >&2
  echo "" >&2
  echo "실행하려면 CONFIRM_DANGEROUS=yes 환경변수를 설정하세요." >&2

  if [ "$CONFIRM_DANGEROUS" != "yes" ]; then
    exit 1  # 차단
  fi
fi
exit 0
```

### 패턴 2: 훅 로깅

```bash
#!/bin/bash
# hooks/audit-logger.sh
INPUT=$(cat)
LOG_FILE="$HOME/.claude/audit.log"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
SESSION=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

echo "[$TIMESTAMP] Session=$SESSION Tool=$TOOL" >> "$LOG_FILE"

# Bash 명령은 내용도 로깅
if [ "$TOOL" = "Bash" ]; then
  CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
  echo "  CMD: $CMD" >> "$LOG_FILE"
fi

exit 0
```

### 패턴 3: 비동기 빌드 트리거

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "touch /tmp/build-needed && echo 'Build queued'",
            "async": true
          }
        ]
      }
    ]
  }
}
```

```bash
# 별도 watcher 프로세스가 /tmp/build-needed 감지 → 빌드 실행
# Claude 블로킹 없이 빌드 병렬 진행
```

---

## 주의사항 및 트러블슈팅

### PreToolUse exit code의 의미

```
exit 0  → 도구 실행 허용
exit 1  → 도구 실행 차단 (stderr 내용이 Claude 컨텍스트에 전달)
exit 2  → 일반 에러 (차단과 동일하게 처리)
```

### timeout 설정 가이드

```json
{
  "timeout": 5000      // 5초 — 빠른 검사 (보안 게이트, 로깅)
  "timeout": 30000     // 30초 — 린팅, 포매팅
  "timeout": 60000     // 60초 — 테스트 실행 (기본값)
  "timeout": 120000    // 120초 — 빌드 검증
}
```

timeout 초과 시: 차단 없이 hook 실행이 취소되고 경고 출력

### 흔한 실수

```bash
# 실수 1: 환경변수로 파일 경로 읽으려 함
FILE="$CLAUDE_FILE_PATH"  # 항상 비어있음!

# 올바른 방법: stdin JSON 파싱
FILE=$(cat | jq -r '.tool_input.file_path // empty')
```

```json
// 실수 2: PostToolUse에서 exit 1로 도구 차단 시도
// PostToolUse는 이미 실행된 도구를 되돌릴 수 없음
// 단, stderr는 Claude 컨텍스트에 전달되어 수정 요청 가능

// 실수 3: 동기 hook에서 무거운 작업
{
  "timeout": 1000,  // 1초 — 테스트 실행에 너무 짧음
  "async": false    // 동기 → Claude 블로킹
}
// 해결: timeout 늘리거나 async: true 사용
```

### 디버깅

```bash
# hook 스크립트 직접 테스트
echo '{"tool_name": "Edit", "tool_input": {"file_path": "/tmp/test.ts"}}' \
  | bash /path/to/hook.sh

# hook 실행 로그 확인
cat ~/.claude/audit.log
tail -f ~/.claude/audit.log
```

---

## 참고 자료

- [Claude Code Hooks Documentation](https://docs.anthropic.com/claude/docs/claude-code/hooks) — 공식 이벤트 목록 및 데이터 스키마
- [Claude Code Settings — hooks](https://docs.anthropic.com/claude/docs/claude-code/settings#hooks) — hooks.json 스키마 참조
- [Lifecycle Events Reference](https://docs.anthropic.com/claude/docs/claude-code/lifecycle) — 17개 이벤트 상세 설명
