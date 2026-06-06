locals {
  name_prefix = "${var.project_name}-${var.environment}"

  site_origin = "https://${var.frontend_domain}"

  cors_origins = distinct(concat(
    [local.site_origin, "https://www.${var.frontend_domain}"],
    var.cors_origins,
  ))
}
