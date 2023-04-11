import { WHITE_LABEL_ORIGINS } from '@cdk/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './tenant-config'

export const Auth0SandboxBureauTenantConfig: Auth0TenantConfig = {
  tenantName: 'sandbox-bureau-flagright',
  region: 'eu',
  customDomain: 'login.tm.sandbox.bureau.id',
  consoleApplicationName: 'Bureau Console (Sandbox)',
  consoleUrl: 'https://tm.sandbox.bureau.id',
  allowedOrigins: [WHITE_LABEL_ORIGINS.bureau.sandbox],
  allowedCallbackUrls: [
    WHITE_LABEL_ORIGINS.bureau.sandbox,
    `${WHITE_LABEL_ORIGINS.bureau.sandbox}/dashboard/analysis`,
  ],
  branding: {
    // TODO: To be provided by Bureau
    logoUrl: 'https://i.imgur.com/c1dqUxB.png',
    primaryColor: '#4715FF',
    pageBackgroundColor: '#EFF2F5',
    companyDisplayName: 'Bureau, Inc.',
  },
  emailProvider: {
    type: 'sendgrid',
    credentialsAwsSecretName: 'bureau/auth0EmailProviderCreds',
    fromAddress: 'tm@bureau.id',
  },
}
