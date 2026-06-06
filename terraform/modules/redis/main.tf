variable "name_prefix" { type = string }
variable "cluster_id" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "log_group_name" { type = string }
variable "service_namespace_id" { type = string }
variable "cpu" { type = number }
variable "memory" { type = number }

resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis"
  description = "Redis for ${var.name_prefix}"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from backend tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.redis_clients.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-redis-sg"
  }
}

# Attached to backend tasks — allows them to reach Redis
resource "aws_security_group" "redis_clients" {
  name        = "${var.name_prefix}-redis-clients"
  description = "ECS tasks that connect to Redis"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-redis-clients-sg"
  }
}

resource "aws_service_discovery_service" "redis" {
  name = "redis"

  dns_config {
    namespace_id = var.service_namespace_id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

resource "aws_ecs_task_definition" "redis" {
  family                   = "${var.name_prefix}-redis"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "redis"
    image     = "redis:7-alpine"
    essential = true
    portMappings = [{
      containerPort = 6379
      protocol      = "tcp"
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = var.log_group_name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "redis"
      }
    }
    healthCheck = {
      command     = ["CMD", "redis-cli", "ping"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 10
    }
  }])
}

data "aws_region" "current" {}

resource "aws_iam_role" "ecs_execution" {
  name = "${var.name_prefix}-redis-exec"

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

resource "aws_ecs_service" "redis" {
  name            = "${var.name_prefix}-redis"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.redis.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.redis.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.redis.arn
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
}

output "service_name" {
  value = aws_ecs_service.redis.name
}

output "redis_clients_security_group_id" {
  value = aws_security_group.redis_clients.id
}
