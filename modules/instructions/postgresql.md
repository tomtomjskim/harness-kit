---
name: postgresql
type: instruction
description: PostgreSQL 데이터베이스 컨벤션 및 쿼리 규칙
tags: [database, postgresql, sql]
section: "## Database Conventions"
priority: 35
variables:
  db_name:
    type: string
    required: false
    default: maindb
    description: 데이터베이스 이름
  schema_name:
    type: string
    required: false
    description: 사용할 스키마 이름
---

### 접속
```bash
docker exec -it postgres psql -U appuser -d {{db_name}}
{{#schema_name}}SET search_path TO {{schema_name}};{{/schema_name}}
```

### 규칙
- 테이블/컬럼명: snake_case
- PK: `id` (serial 또는 uuid)
- 타임스탬프: `created_at`, `updated_at` (NOT NULL DEFAULT NOW())
- soft delete: `is_active` boolean 또는 `deleted_at` timestamp
- 인덱스: 외래키, 자주 검색하는 컬럼에 필수
- 스키마 분리: 서비스별 별도 스키마 사용 (public 스키마 직접 사용 지양)
- 마이그레이션: 순번 파일명 (`001_create_users.sql`)
- 쿼리: parameterized query 필수 (SQL injection 방지)
- VACUUM: 대용량 테이블 주기적 실행
