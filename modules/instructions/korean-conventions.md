---
name: korean-conventions
type: instruction
description: 한국어 프로젝트 컨벤션 (커밋 메시지, 주석, 문서화)
tags: [convention, korean, i18n]
section: "## Conventions"
priority: 50
dependencies: [base]
---

- 커밋 메시지는 한국어로 작성 가능
- 코드 주석은 한국어/영어 혼용 가능
- API 응답 메시지는 한국어로 제공
- 에러 메시지는 사용자에게 보이는 것은 한국어, 로그는 영어
- 날짜 형식: YYYY-MM-DD (ISO 8601)
- 세션 종료 시 반드시 세션 작업 서머리 출력 (형식: 작업 내용, 변경 파일 테이블, 커밋, 미완료 작업)
