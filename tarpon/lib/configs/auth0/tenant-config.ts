import { Auth0TenantConfig } from '@lib/configs/auth0/type'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { Auth0DevTenantConfig } from './tenant-config-dev'
import { Auth0ProdTenantConfig } from './tenant-config-prod'
import { Auth0SandboxTenantConfig } from './tenant-config-sandbox'
import { Auth0SandboxRegtankTenantConfig } from './tenant-config-sandbox-regtank'
import { Auth0SandboxZigramTenantConfig } from './tenant-config-sandbox-zigram'
import { Auth0ProdRegtankTenantConfig } from './tenant-config-prod-regtank'
import { Auth0SandboxTraxionRightTenantConfig } from './tenant-config-sandbox-traxionright'
import { Auth0ProdTraxionRightTenantConfig } from './tenant-config-prod-traxionright'

const REGION_TENANT_CONFIGS: { [key: string]: Auth0TenantConfig[] } = {
  'asia-1': [Auth0ProdRegtankTenantConfig, Auth0ProdTraxionRightTenantConfig],
}

export function getAuth0TenantConfigs(
  stage: Stage,
  region?: FlagrightRegion
): Auth0TenantConfig[] {
  switch (stage) {
    case 'local': {
      return [Auth0DevTenantConfig]
    }
    case 'dev': {
      return [Auth0DevTenantConfig]
    }
    case 'sandbox': {
      return [
        Auth0SandboxTenantConfig,
        Auth0SandboxRegtankTenantConfig,
        Auth0SandboxZigramTenantConfig,
        Auth0SandboxTraxionRightTenantConfig,
      ]
    }
    case 'prod': {
      let tenantConfigs = [Auth0ProdTenantConfig]
      if (region && REGION_TENANT_CONFIGS[region]) {
        tenantConfigs = tenantConfigs.concat(REGION_TENANT_CONFIGS[region])
      } else if (!region) {
        tenantConfigs = tenantConfigs.concat(
          Object.values(REGION_TENANT_CONFIGS).flatMap((v) => v)
        )
      }
      return tenantConfigs
    }
    default:
      return []
  }
}
