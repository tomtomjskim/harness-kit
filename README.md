# harness-kit

Claude Code 전용 하네스 프레임워크 — hooks, MCP, agents, settings, memory, workflows를 모듈화하여 관리

## 왜 harness-kit인가?

기존 도구들(Ruler, ai-rulez 등)은 텍스트 규칙 파일(CLAUDE.md, .cursorrules)만 관리합니다.
harness-kit은 Claude Code의 **프로그래매틱 설정 전체**를 모듈화합니다:

- **hooks** — 자동 포맷팅, 보안 게이트, 테스트 실행
- **MCP servers** — 코드 분석, DB 접근, GitHub 통합
- **agents** — 역할별 에이전트 (architect, developer, reviewer)
- **permissions** — 도구 접근 제어 (allow/deny)
- **workflows** — 다단계 작업 오케스트레이션
- **skills** — 도메인 지식 모듈

## Quick Start

### 설치 (npm 없이 git clone)

```bash
# 1. 소스 클론
git clone https://github.com/tomtomjskim/harness-kit.git ~/.harness-kit/source
cd ~/.harness-kit/source && npm install && npm run build

# 2. CLI를 PATH에 추가
echo 'export PATH="$HOME/.harness-kit/source/node_modules/.bin:$HOME/.harness-kit/source/dist:$PATH"' >> ~/.bashrc
echo 'export HARNESS_MODULE_ROOT="$HOME/.harness-kit/modules"' >> ~/.bashrc
source ~/.bashrc

# 3. 글로벌 모듈 설치
harness-kit install-modules

# 4. 환경 확인
harness-kit doctor
```

### 프로젝트에 적용

```bash
cd your-project

# 자동 초기화 (프로젝트 감지 → 모듈 추천 → 즉시 빌드)
harness-kit init

# 또는 기존 CLAUDE.md에서 모듈 추출
harness-kit import ./CLAUDE.md
```

### 주요 명령

```bash
harness-kit build            # 모듈 → Claude Code 설정 빌드
harness-kit build --verbose  # 상세 빌드 로그
harness-kit build --dry-run  # 미리보기 (파일 생성 안 함)
harness-kit list             # 사용 가능 모듈 목록
harness-kit list --search security  # 모듈 검색
harness-kit create-module my-rule --type instruction  # 새 모듈 생성
harness-kit import ./CLAUDE.md  # 기존 CLAUDE.md → 모듈 분해
harness-kit doctor           # 환경 진단
```

### 빌드 시 자동 생성되는 파일

| 파일 | 역할 |
|------|------|
| `CLAUDE.md` | instruction 모듈 병합 결과 |
| `.claude/settings.json` | hooks + MCP 서버 설정 |
| `.claude/settings.local.json` | 권한 설정 (gitignore 대상) |
| `.claude/agents/*.md` | 에이전트 정의 |
| `.claude/commands/harness.md` | `/harness` 슬래시 커맨드 |
| `.claude/skills/harness-kit/SKILL.md` | 자동 감지 스킬 |

## 문서

- [하네스 엔지니어링이란?](docs/harness-engineering/01-what-is-harness.md)
- [Claude Code 설정 파일 해부](docs/harness-engineering/02-claude-code-anatomy.md)
- [Hooks 심화](docs/harness-engineering/03-hooks-deep-dive.md)
- [MCP 서버 조합 패턴](docs/harness-engineering/04-mcp-patterns.md)
- [멀티에이전트 설계](docs/harness-engineering/05-agents-design.md)
- [Memory 계층 설계](docs/harness-engineering/06-memory-system.md)
- [생태계 현황](docs/harness-engineering/07-ecosystem-landscape.md)

## 아키텍처

### 빌드 파이프라인 (6단계)
Resolver → Loader → Validator → Merger → Renderer → Writer

### 모듈 타입 (8개)
instruction, hook, mcp, permission, agent, workflow, skill, preset

## 로드맵

- [x] Phase 0: 학습 문서 + 프로젝트 골격
- [ ] Phase 1: 코어 CLI (init, build, import, list, doctor)
- [ ] Phase 1.5: Dog-fooding (자체 프로젝트 적용)
- [ ] Phase 2: 모듈 라이브러리 확장
- [ ] Phase 3: MCP 서버 통합, 커뮤니티 모듈

## License

MIT
