resource "aws_service_discovery_private_dns_namespace" "this" {
  name        = "${local.name_prefix}.local"
  description = "Private DNS for ${local.name_prefix} ECS services"
  vpc         = module.network.vpc_id
}

module "network" {
  source = "./modules/network"

  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
}

module "ecs" {
  source = "./modules/ecs"

  name_prefix = local.name_prefix
  aws_region  = var.aws_region
}

module "redis" {
  source = "./modules/redis"

  name_prefix          = local.name_prefix
  cluster_id           = module.ecs.cluster_id
  vpc_id               = module.network.vpc_id
  private_subnet_ids   = module.network.private_subnet_ids
  log_group_name       = module.ecs.log_group_name
  service_namespace_id = aws_service_discovery_private_dns_namespace.this.id
  cpu                  = var.redis_cpu
  memory               = var.redis_memory
}

module "backend" {
  source = "./modules/backend"

  name_prefix                     = local.name_prefix
  aws_region                      = var.aws_region
  cluster_id                      = module.ecs.cluster_id
  vpc_id                          = module.network.vpc_id
  public_subnet_ids               = module.network.public_subnet_ids
  private_subnet_ids              = module.network.private_subnet_ids
  log_group_name                  = module.ecs.log_group_name
  ecr_repository_url              = module.ecs.ecr_repository_url
  image_tag                       = var.backend_image_tag
  desired_count                   = var.backend_desired_count
  cpu                             = var.backend_cpu
  memory                          = var.backend_memory
  database_url_secret_arn         = aws_secretsmanager_secret.database_url.arn
  redis_url                       = "redis://redis.${local.name_prefix}.local:6379/0"
  jwt_secret_key                  = var.jwt_secret_key
  internal_jwt                    = var.internal_jwt
  jwt_secret_key_previous         = var.jwt_secret_key_previous
  internal_jwt_previous           = var.internal_jwt_previous
  cors_origins                    = local.cors_origins
  redis_clients_security_group_id = module.redis.redis_clients_security_group_id
}

module "frontend" {
  source = "./modules/frontend"

  name_prefix         = local.name_prefix
  frontend_domain     = var.frontend_domain
  api_origin_domain   = module.backend.alb_dns_name
  acm_certificate_arn = var.frontend_acm_certificate_arn
}
