variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-west-1"
}

variable "project_name" {
  description = "Short project slug used in resource names"
  type        = string
  default     = "chaturanga"
}

variable "environment" {
  description = "Environment name (prod, staging, ...)"
  type        = string
  default     = "prod"
}

# --- Frontend (S3 + CloudFront → point Cloudflare DNS here) ---

variable "frontend_domain" {
  description = "Public site hostname — React at /, API at /api/*, WebSocket at /ws (CORS + CloudFront alias)"
  type        = string
}

variable "frontend_acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for CloudFront HTTPS (optional)"
  type        = string
  default     = null
}

# --- Backend API (reachable via CloudFront /api/* and /ws) ---

variable "backend_desired_count" {
  description = "Number of uvicorn ECS tasks behind the load balancer"
  type        = number
  default     = 2
}

variable "backend_cpu" {
  type    = number
  default = 512
}

variable "backend_memory" {
  type    = number
  default = 1024
}

variable "backend_image_tag" {
  description = "Docker image tag deployed to ECS (push to ECR first)"
  type        = string
  default     = "latest"
}

# --- External Postgres (shared server, separate schema) ---

variable "database_url" {
  description = "SQLAlchemy URL stored in Secrets Manager (not passed plain to ECS)"
  type        = string
  sensitive   = true
}

variable "rds_region" {
  description = "Region where the external RDS instance lives"
  type        = string
  default     = "us-east-1"
}

variable "rds_security_group_id" {
  description = "RDS security group to allow chesstrikes ECS egress"
  type        = string
}

variable "rds_vpc_id" {
  description = "VPC id of the RDS instance — set to match aws_region VPC to allow SG-based access instead of NAT IP"
  type        = string
  default     = null
}

variable "postgres_schema" {
  description = "Legacy name; unused for MySQL (schema = database name in MySQL)"
  type        = string
  default     = "chaturanga"
}

# --- App secrets (set in terraform.tfvars, never commit) ---

variable "jwt_secret_key" {
  type      = string
  sensitive = true
}

variable "internal_jwt" {
  type      = string
  sensitive = true
}

variable "jwt_secret_key_previous" {
  type      = string
  default   = null
  sensitive = true
}

variable "internal_jwt_previous" {
  type      = string
  default   = null
  sensitive = true
}

variable "cors_origins" {
  description = "Extra CORS origins JSON-style list; frontend_domain https URL is always included"
  type        = list(string)
  default     = []
}

# --- Redis ECS task ---

variable "redis_cpu" {
  type    = number
  default = 256
}

variable "redis_memory" {
  type    = number
  default = 512
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}
