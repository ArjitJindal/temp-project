import { Auth0TenantConfig } from '@lib/configs/auth0/type'
import { Auth0DevTenantConfig } from './tenant-config-dev'
import { Auth0ProdTenantConfig } from './tenant-config-prod'
import { Auth0ProdBureauTenantConfig } from './tenant-config-prod-bureau'
import { Auth0SandboxTenantConfig } from './tenant-config-sandbox'
import { Auth0SandboxBureauTenantConfig } from './tenant-config-sandbox-bureau'

export function getAuth0TenantConfigs(
  stage: 'local' | 'dev' | 'sandbox' | 'prod'
): Auth0TenantConfig[] {
  switch (stage) {
    case 'local': {
      return [Auth0DevTenantConfig]
    }
    case 'dev': {
      return [Auth0DevTenantConfig]
    }
    case 'sandbox': {
      return [Auth0SandboxTenantConfig, Auth0SandboxBureauTenantConfig]
    }
    case 'prod': {
      return [Auth0ProdTenantConfig, Auth0ProdBureauTenantConfig]
    }
    default:
      return []
  }
}
