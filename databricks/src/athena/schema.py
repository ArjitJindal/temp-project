def tenant_schema(tenant: str) -> str:
    return tenant.replace("-", "_")
