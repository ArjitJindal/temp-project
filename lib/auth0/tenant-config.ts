import { Auth0DevTenantConfig } from './tenant-config-dev'
import { Auth0ProdTenantConfig } from './tenant-config-prod'
import { Auth0ProdBureauTenantConfig } from './tenant-config-prod-bureau'
import { Auth0SandboxTenantConfig } from './tenant-config-sandbox'
import { Auth0SandboxBureauTenantConfig } from './tenant-config-sandbox-bureau'

export type Auth0TenantConfig = {
  tenantName: string
  region: 'eu'
  customDomain: string
  consoleApplicationName: string
  consoleUrl: string
  allowedOrigins: string[]
  allowedCallbackUrls: string[]
  branding: {
    logoUrl: string
    primaryColor: string
    pageBackgroundColor: string
    companyDisplayName: string
  }
  emailProvider: {
    type: 'sendgrid'
    credentialsAwsSecretName: string
    fromAddress: string
  }
}

export function getAuth0TenantConfigs(
  stage: 'local' | 'dev' | 'sandbox' | 'prod'
): Auth0TenantConfig[] {
  switch (stage) {
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
