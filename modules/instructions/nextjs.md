---
name: nextjs
type: instruction
description: Next.js 15 프로젝트 컨벤션 및 개발 규칙
tags: [framework, nextjs, react, typescript]
section: "## Next.js Conventions"
priority: 40
---

- App Router 사용 (`app/` 디렉토리)
- Server Components 기본, Client Components는 `'use client'` 명시
- API Routes: `app/api/*/route.ts` (GET, POST, PUT, DELETE export)
- 정적 파일: `public/` 디렉토리
- 환경변수: `NEXT_PUBLIC_*`만 클라이언트 노출, 나머지는 서버 전용
- 이미지: `next/image` 컴포넌트 사용 (자동 최적화)
- 폰트: `next/font` 사용 (자체 호스팅)
- shadcn/ui 사용 시: `@/components/ui/` 경로, 직접 수정 가능
- `_next/static/` 경로는 nginx rate limiting 제외 필수 (503 에러 방지)
- Metadata API로 SEO 설정 (`generateMetadata`)
