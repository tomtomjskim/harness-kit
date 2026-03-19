---
name: fastapi
type: instruction
description: FastAPI/Python 프로젝트 컨벤션 및 개발 규칙
tags: [framework, fastapi, python, api]
section: "## FastAPI Conventions"
priority: 40
---

- 프로젝트 구조: `app/` 패키지, `app/main.py` 진입점
- 라우터 분리: `app/routers/*.py` (APIRouter 사용)
- Pydantic 모델: 요청/응답 스키마 분리 (`app/schemas/`)
- 의존성 주입: `Depends()` 활용 (DB 세션, 인증 등)
- 비동기: `async def` 기본, 동기 블로킹 작업은 `run_in_executor`
- 환경변수: `pydantic-settings`의 `BaseSettings` 사용
- 테스트: `pytest` + `httpx.AsyncClient`
- DB: SQLAlchemy 2.0 (async) 또는 직접 asyncpg
- 마이그레이션: Alembic
- Health check: `GET /health` → `{"status": "ok"}`
- CORS: `CORSMiddleware` 허용 origin 명시
