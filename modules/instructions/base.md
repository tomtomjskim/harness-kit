---
name: base
type: instruction
description: 모든 프로젝트에 적용되는 기본 하네스 규칙
tags: [core, base]
section: "## General Conventions"
priority: 10
---

- Korean comments and commit messages are acceptable
- All services should expose a `/health` endpoint for monitoring
- Environment variables are passed through docker-compose.yml; projects should not read `.env` directly
- Prefer editing existing files over creating new ones
- Keep solutions simple and focused — don't add features beyond what was asked
- Session Summary is required at commit/push or session end
