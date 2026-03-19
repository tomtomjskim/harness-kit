# Changelog

## [0.1.0] - 2026-03-19

### Phase 0: 프로젝트 초기화
- 하네스 엔지니어링 학습 문서 7편 작성
  - 개념 정리 (Martin Fowler, Codified Context 논문)
  - Claude Code 설정 파일 전체 해부
  - Hooks 17개 이벤트 심화 + 실전 유즈케이스
  - MCP 서버 조합 패턴
  - 멀티에이전트 설계 (2-레이어, 최소 권한)
  - Memory 계층 설계 (Hot/Cold)
  - 경쟁 도구 비교 (Ruler, ai-rulez, block/ai-rules)
- TypeScript + ESM 프로젝트 골격
- Zod v4 기반 8개 모듈 타입 스키마

### Phase 1: 코어 구현
- 6단계 빌드 파이프라인
  - Resolver: 모듈 경로 탐색 + Levenshtein fuzzy match
  - Loader: gray-matter + js-yaml 타입별 body 파싱
  - Validator: Zod 스키마 검증 + Kahn's algorithm 사이클 탐지
  - Merger: 타입별 병합 (event-merge, merge-key, union-set, file-per)
  - Renderer: mustache strict 변수 주입 + per-module vars
  - Writer: atomic rename + self-referential 헤더 + manifest
- CLI 7개 명령: init, build, list, import, doctor, create-module, install-modules
- 내장 모듈 10개 (instructions 3, hooks 2, mcp 1, agents 3, workflows 1)

### Phase 1.5: Dog-fooding + 보안 수정
- 3개 프로젝트 적용 (service-portal, sports-analysis, blog-automation)
- 평균 커버리지 99%
- 보안 수정: ConfigModuleEntry name kebab-case 강제 (경로 순회 방지)
- 보안 수정: Writer outputDir 경계 검사
- 버그 수정: per-module vars 렌더링, hook command 변수 치환
- import 파서: 코드블록 내 ## 무시, section frontmatter 자동 삽입

### Claude Code 통합
- `/harness` 슬래시 커맨드 자동 생성
- 자동 감지 스킬 (CLAUDE.md 직접 수정 방지)
- PostToolUse auto-build hook (harness.config.yaml 변경 시 자동 빌드)

### 설계 개선
- `when:` 조건부 모듈 평가 (file_exists, package_has, env_set)
- `--profile` 환경별 빌드 (dev/prod)
- `custom` 블록 배열 + position (prepend/append)
- merger/renderer 단위 테스트 25개 추가 (총 36개)
- CLI 전역 에러 핸들러 통일

### 모듈 확장 (총 20개)
- Instructions: base, korean-conventions, docker-project, nextjs, express, fastapi, postgresql, git-pr-flow
- Hooks: security-gate, auto-format, test-runner, commit-guard, notify
- MCP: serena
- Agents: architect, developer, security-reviewer
- Permissions: docker-safe, git-safe
- Workflows: standard

### 프로젝트 전환 (3/3 완료)
- sports-analysis: harness-kit 관리로 전환
- jsnetworkcorp-service-portal: harness-kit 관리로 전환
- blog-automation: harness-kit 관리로 전환
