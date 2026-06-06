output "frontend_s3_bucket" {
  description = "Upload React build here (see README deploy-frontend script)"
  value       = module.frontend.bucket_id
}

output "site_domain" {
  description = "Public hostname (frontend + /api + /ws on same origin)"
  value       = var.frontend_domain
}

output "site_url" {
  description = "Public site URL"
  value       = "https://${var.frontend_domain}"
}

output "frontend_cloudfront_domain" {
  description = "CNAME target in Cloudflare for chesstrikes.com (proxy enabled)"
  value       = module.frontend.cloudfront_domain_name
}

output "frontend_cloudfront_distribution_id" {
  description = "Use for cache invalidation after deploy"
  value       = module.frontend.cloudfront_distribution_id
}

output "api_load_balancer_dns" {
  description = "ALB DNS (internal origin for CloudFront /api and /ws — do not expose in public DNS)"
  value       = module.backend.alb_dns_name
}

output "ecr_repository_url" {
  description = "docker build -t ... && docker push ..."
  value       = module.ecs.ecr_repository_url
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "backend_service_name" {
  value = module.backend.service_name
}

output "redis_service_name" {
  value = module.redis.service_name
}

output "ecs_nat_public_ip" {
  description = "Allow this /32 on external RDS (managed automatically when rds_security_group_id is set)"
  value       = module.network.nat_public_ip
}

output "backend_security_group_id" {
  description = "ECS backend SG — use for same-VPC RDS ingress (set rds_vpc_id to enable in Terraform)"
  value       = module.backend.backend_security_group_id
}

output "database_url_secret_arn" {
  description = "Secrets Manager ARN for DATABASE_URL (ECS execution role has read access)"
  value       = aws_secretsmanager_secret.database_url.arn
}

output "aws_region" {
  value = var.aws_region
}
