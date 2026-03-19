---
name: express
type: instruction
description: Express.js API 서버 컨벤션 및 미들웨어 패턴
tags: [framework, express, nodejs, api]
section: "## Express Conventions"
priority: 40
---

- 라우터 분리: `routes/*.js` 또는 `routes/*.ts`
- 미들웨어 순서: cors → helmet → rate-limit → auth → routes → error-handler
- 에러 핸들링: 중앙 에러 핸들러 (`(err, req, res, next)`)
- 응답 형식 통일: `{ data: T, meta?: {} }` (성공) / `{ error: { code, message } }` (실패)
- 환경변수: `process.env.*` 직접 참조 대신 config 모듈에서 검증 후 export
- Health check: `GET /health` → `{ status: 'ok', uptime, version }`
- 로깅: 구조화된 JSON 로그 (request ID 포함)
- CORS: 허용 origin 명시적 설정 (wildcard 금지)
- Rate limiting: API 경로별 zone 분리
