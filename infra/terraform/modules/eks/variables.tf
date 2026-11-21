variable "cluster_name" {
  description = "Name of the Amazon EKS cluster."
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes minor version for the EKS cluster (standard support)."
  type        = string
  default     = "1.35"
}

variable "vpc_id" {
  description = "VPC ID where the EKS cluster will be deployed."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for the EKS control plane and worker nodes."
  type        = list(string)
}

variable "endpoint_public_access" {
  description = "Enable public access to the EKS API server endpoint (keep false or restrict CIDRs in production)."
  type        = bool
  default     = false
}

variable "endpoint_public_access_cidrs" {
  description = "List of CIDR blocks permitted to reach the public EKS API endpoint when enabled."
  type        = list(string)
  default     = []
}

variable "access_entries" {
  description = "Additional EKS access entries (replaces legacy aws-auth ConfigMap)."
  type        = any
  default     = {}
}

variable "tags" {
  description = "Additional tags applied to EKS resources."
  type        = map(string)
  default     = {}
}
