variable "name_prefix" { type = string }
variable "aws_region" { type = string }
variable "cluster_id" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "log_group_name" { type = string }
variable "ecr_repository_url" { type = string }
variable "image_tag" { type = string }
variable "desired_count" { type = number }
variable "cpu" { type = number }
variable "memory" { type = number }
variable "database_url_secret_arn" {
  description = "Secrets Manager ARN for DATABASE_URL (injected by ECS execution role)"
  type        = string
}
variable "redis_url" { type = string }
variable "jwt_secret_key" { type = string }
variable "internal_jwt" { type = string }
variable "jwt_secret_key_previous" {
  type    = string
  default = null
}
variable "internal_jwt_previous" {
  type    = string
  default = null
}
variable "cors_origins" { type = list(string) }
variable "redis_clients_security_group_id" { type = string }

data "aws_region" "current" {}

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb"
  description = "Public ALB for ${var.name_prefix} API"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-alb-sg"
  }
}

resource "aws_security_group" "backend" {
  name        = "${var.name_prefix}-backend"
  description = "ECS backend tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "API from ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-backend-sg"
  }
}

resource "aws_lb" "api" {
  name               = "${var.name_prefix}-api"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  idle_timeout = 4000 # WebSocket-friendly

  tags = {
    Name = "${var.name_prefix}-api-alb"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.name_prefix}-api"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.name_prefix}-api-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

resource "aws_iam_role" "ecs_execution" {
  name = "${var.name_prefix}-backend-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.name_prefix}-backend-exec-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.database_url_secret_arn]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.name_prefix}-backend-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

locals {
  cors_json = jsonencode(var.cors_origins)
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.name_prefix}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${var.ecr_repository_url}:${var.image_tag}"
    essential = true
    portMappings = [{
      containerPort = 8000
      protocol      = "tcp"
    }]
    environment = concat(
      [
        { name = "REDIS_URL", value = var.redis_url },
        { name = "JWT_SECRET_KEY", value = var.jwt_secret_key },
        { name = "INTERNAL_JWT", value = var.internal_jwt },
        { name = "JWT_BLACKLIST_ENABLED", value = "True" },
        { name = "JWT_BLACKLIST_TOKEN_CHECKS", value = jsonencode(["access", "refresh"]) },
        { name = "CORS_ORIGINS", value = local.cors_json },
        { name = "DEBUG", value = "false" },
      ],
      var.jwt_secret_key_previous != null ? [{
        name = "JWT_SECRET_KEY_PREVIOUS", value = var.jwt_secret_key_previous
      }] : [],
      var.internal_jwt_previous != null ? [{
        name = "INTERNAL_JWT_PREVIOUS", value = var.internal_jwt_previous
      }] : [],
    )
    secrets = [{
      name      = "DATABASE_URL"
      valueFrom = var.database_url_secret_arn
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = var.log_group_name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "backend"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

resource "aws_ecs_service" "backend" {
  name            = "${var.name_prefix}-backend"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.backend.id, var.redis_clients_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [aws_lb_listener.http]
}

output "alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "service_name" {
  value = aws_ecs_service.backend.name
}

output "backend_security_group_id" {
  value = aws_security_group.backend.id
}
