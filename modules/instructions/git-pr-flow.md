---
name: git-pr-flow
type: instruction
description: PR 기반 Git 워크플로우 규칙 (dev → PR → main)
tags: [git, workflow, pr, convention]
section: "## Git Workflow (필수)"
priority: 20
variables:
  base_branch:
    type: string
    required: false
    default: main
    description: 베이스 브랜치
  dev_branch:
    type: string
    required: false
    default: dev
    description: 개발 브랜치
---

### 규칙
- **{{base_branch}} 브랜치 직접 커밋/머지/푸시 절대 금지**
- 작업 순서: {{dev_branch}} 작업 → push {{dev_branch}} → `gh pr create` → PR URL 제공 → 사용자 확인 후 merge
- PR 제목: 70자 이내, 변경 내용 요약
- PR 본문: ## Summary + ## Test plan
- DB 마이그레이션이 포함된 PR은 파일명과 변경 내용을 본문에 명시
- merge 후 {{dev_branch}} 브랜치에서 `git pull origin {{base_branch}}`로 동기화
