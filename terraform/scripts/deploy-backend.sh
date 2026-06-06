#!/usr/bin/env bash
# Build and push backend image to ECR (run from repo root after terraform apply).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$(cd "$(dirname "$0")/.." && pwd)"

AWS_REGION="${AWS_REGION:-$(terraform -chdir="$TF_DIR" output -raw aws_region 2>/dev/null || echo eu-west-1)}"
ECR_URL="$(terraform -chdir="$TF_DIR" output -raw ecr_repository_url)"
IMAGE_TAG="${IMAGE_TAG:-latest}"
# ECS Fargate is linux/amd64 — required when building on Apple Silicon Macs.
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"

echo "Building backend for ${ECR_URL}:${IMAGE_TAG} (${DOCKER_PLATFORM}) ..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${ECR_URL%%/*}"

docker build --platform "${DOCKER_PLATFORM}" -t "${ECR_URL}:${IMAGE_TAG}" "$ROOT/backend"
docker push "${ECR_URL}:${IMAGE_TAG}"

CLUSTER="$(terraform -chdir="$TF_DIR" output -raw ecs_cluster_name)"
SERVICE="$(terraform -chdir="$TF_DIR" output -raw backend_service_name)"

echo "Forcing ECS deployment ..."
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment --region "$AWS_REGION" >/dev/null
echo "Done. Watch ECS console for rollout."
