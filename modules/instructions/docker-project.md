---
name: docker-project
type: instruction
description: Docker 기반 프로젝트의 빌드/배포 규칙
tags: [docker, deployment, infrastructure]
section: "## Docker Commands"
priority: 30
variables:
  service_name:
    type: string
    required: true
    description: Docker Compose 서비스 이름
  compose_file:
    type: string
    required: false
    default: docker-compose.yml
    description: Docker Compose 파일 경로
  container_ip:
    type: string
    required: false
    description: 컨테이너 고정 IP (webnet)
  mem_limit:
    type: string
    required: false
    default: 256m
    description: 컨테이너 메모리 제한
---

### 배포
```bash
# 서비스 빌드 및 배포
docker compose -f {{compose_file}} build {{service_name}}
docker compose -f {{compose_file}} up -d --no-deps {{service_name}}

# 상태 확인
docker compose -f {{compose_file}} ps
docker compose -f {{compose_file}} logs -f {{service_name}}

# 재시작
docker compose -f {{compose_file}} restart {{service_name}}
```

### 리소스 제한
- Memory limit: {{mem_limit}}
{{#container_ip}}- Container IP: {{container_ip}} (webnet){{/container_ip}}

### 주의사항
- 빌드 시 `--no-deps` 플래그로 의존 서비스 재시작 방지
- Health check endpoint (`/health`) 확인 후 배포 완료 판단
