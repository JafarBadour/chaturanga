#!/usr/bin/env bash
# Build React app and sync to S3 + invalidate CloudFront (run from repo root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$(cd "$(dirname "$0")/.." && pwd)"

API_URL="${REACT_APP_API_URL:-}"
# Same-origin prod: empty API_URL → fetch("/api/v1/...") on chesstrikes.com
BUCKET="$(terraform -chdir="$TF_DIR" output -raw frontend_s3_bucket)"
DIST_ID="$(terraform -chdir="$TF_DIR" output -raw frontend_cloudfront_distribution_id)"
AWS_REGION="${AWS_REGION:-eu-west-1}"

echo "Building frontend with REACT_APP_API_URL=${API_URL:-<same-origin>} ..."
cd "$ROOT/frontend"
npm ci
REACT_APP_API_URL="$API_URL" npm run build

echo "Syncing to s3://${BUCKET} ..."
aws s3 sync build/ "s3://${BUCKET}/" --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.html"

aws s3 cp build/index.html "s3://${BUCKET}/index.html" \
  --cache-control "public,max-age=0,must-revalidate"

for html in build/*.html; do
  [ -f "$html" ] || continue
  base="$(basename "$html")"
  [ "$base" = "index.html" ] && continue
  aws s3 cp "$html" "s3://${BUCKET}/${base}" \
    --cache-control "public,max-age=0,must-revalidate"
done

echo "Invalidating CloudFront ${DIST_ID} ..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null
echo "Frontend deploy complete."
