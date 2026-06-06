# External RDS access: Secrets Manager (IAM role) + network allowlist.

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name_prefix}/database-url"
  recovery_window_in_days = 7

  tags = {
    Name = "${local.name_prefix}-database-url"
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = var.database_url
}

# Cross-region / public RDS: ECS tasks egress via NAT with a stable Elastic IP.
resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs_nat" {
  provider = aws.rds

  security_group_id = var.rds_security_group_id
  ip_protocol       = "tcp"
  from_port         = 3306
  to_port           = 3306
  cidr_ipv4         = "${module.network.nat_public_ip}/32"
  description       = "${local.name_prefix} ECS NAT egress (${var.aws_region})"
}

# Same-VPC RDS only: allow the backend ECS security group directly (no NAT IP needed).
resource "aws_vpc_security_group_ingress_rule" "rds_from_backend_sg" {
  count = var.rds_vpc_id != null && var.rds_vpc_id == module.network.vpc_id ? 1 : 0

  provider = aws.rds

  security_group_id            = var.rds_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
  referenced_security_group_id = module.backend.backend_security_group_id
  description                  = "${local.name_prefix} backend ECS tasks (same VPC)"
}
