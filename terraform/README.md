# ChessStrikes — AWS infrastructure (Terraform)

Production layout (single domain):

| Path | Serves |
|------|--------|
| `https://chesstrikes.com/` | React SPA (S3 via CloudFront) |
| `https://chesstrikes.com/api/*` | FastAPI (ECS Fargate via ALB → CloudFront) |
| `https://chesstrikes.com/ws` | WebSocket games (same ALB origin) |

| Layer | AWS | Cloudflare |
|-------|-----|------------|
| **Site** (frontend + API paths) | S3 + CloudFront (path routing to ALB) | CNAME `@` → CloudFront (proxy ON, WebSockets ON) |
| **Backend** (uvicorn / FastAPI, 2 tasks) | ECS Fargate + public ALB (CloudFront origin only) | — |
| **Redis** (matchmaking / pubsub) | ECS Fargate (private subnet) | — |
| **MySQL** | Your existing RDS (`royalechess` database) | — |

CloudFront routes `/api/*` and `/ws` to the ALB; everything else goes to the S3 bucket (SPA).

## Prerequisites

- AWS CLI + credentials
- Terraform >= 1.5
- Docker (backend image)
- Node (frontend build)
- Existing Postgres — create schema first:

```sql
CREATE SCHEMA IF NOT EXISTS chaturanga;
GRANT ALL ON SCHEMA chaturanga TO your_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA chaturanga TO your_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA chaturanga GRANT ALL ON TABLES TO your_app_user;
```

## Setup

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — database_url, JWT secrets, frontend_domain

terraform init
terraform plan
terraform apply
```

## Deploy application

```bash
# 1. Backend → ECR → ECS (2 replicas behind ALB)
#    Builds linux/amd64 for Fargate (override: DOCKER_PLATFORM=linux/arm64 if you switch ECS to Graviton)
chmod +x scripts/*.sh
./scripts/deploy-backend.sh

# 2. Frontend → S3 → CloudFront (same-origin API — no REACT_APP_API_URL needed)
./scripts/deploy-frontend.sh
```

## Cloudflare DNS

After `terraform apply`, point the apex domain at CloudFront (proxied):

| Type | Name | Target |
|------|------|--------|
| CNAME | `@` | `frontend_cloudfront_domain` output |

Optional: CNAME `www` → same CloudFront domain (included in CORS).

In Cloudflare → **Network**: enable **WebSockets** (required for `/ws`).

Do **not** create a separate `api` subdomain — the API lives at `/api` on the main domain.

SSL mode: **Full** (Cloudflare → AWS HTTP on ALB:80 is fine; upgrade to HTTPS on ALB later with ACM if needed).

## Database access

- **Credentials:** `database_url` is stored in **Secrets Manager**. The ECS **execution role** reads it at task start (not plain env in the task definition).
- **Network:** Terraform opens the external RDS security group to:
  - **NAT Elastic IP** (`ecs_nat_public_ip` output) — required when RDS is in another region/VPC (current setup: ECS `eu-west-1`, RDS `us-east-1`).
  - **Backend security group** — automatic when `rds_vpc_id` matches the ECS VPC (same-VPC RDS; no IP allowlist needed).

Set in `terraform.tfvars`:

```hcl
rds_region            = "us-east-1"
rds_security_group_id = "sg-xxxxxxxx"
# rds_vpc_id = "vpc-xxxxxxxx"  # only if RDS is in the same VPC as ECS
```

Alembic migrations run on container start (`docker-entrypoint.sh`).

## Structure

```
terraform/
├── main.tf              # wires modules
├── variables.tf         # secrets + domain → terraform.tfvars
├── outputs.tf
├── modules/
│   ├── network/         # VPC, public/private subnets, NAT
│   ├── frontend/        # S3 + CloudFront (SPA + /api + /ws → ALB)
│   ├── ecs/             # cluster, ECR, logs
│   ├── redis/           # Fargate Redis + Cloud Map DNS
│   └── backend/         # Fargate API x2, ALB, stickiness for WS
└── scripts/
    ├── deploy-backend.sh
    └── deploy-frontend.sh
```

## Notes

- **No RDS** in this stack — DB URI comes from `terraform.tfvars`.
- Redis URL inside the cluster: `redis://redis.<name_prefix>.local:6379/0`
- ALB idle timeout 4000s for long-lived WebSocket games.
- Target group stickiness helps WS during reconnects.
- Optional `frontend_acm_certificate_arn` (must be **us-east-1**) for custom HTTPS on CloudFront.
