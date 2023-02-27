import { WHITE_LABEL_ORIGINS } from '@cdk/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './tenant-config'

export const Auth0SandboxBureauTenantConfig: Auth0TenantConfig = {
  tenantName: 'sandbox-bureau-flagright',
  region: 'eu',
  // TODO: set up custom domain
  customDomain: 'sandbox-bureau-flagright.eu.auth0.com',
  consoleApplicationName: 'Bureau Console (Sandbox)',
  consoleUrl: 'https://tm.sandbox.bureau.id',
  allowedOrigins: [WHITE_LABEL_ORIGINS.bureau.sandbox],
  branding: {
    // TODO: To be provided by Bureau
    logoUrl: 'https://i.imgur.com/c1dqUxB.png',
    primaryColor: '#4715FF',
    pageBackgroundColor: '#EFF2F5',
    companyDisplayName: 'Bureau, Inc.',
  },
  emailProvider: {
    type: 'sendgrid',
    // TODO: To be provided by Bureau
    credentialsAwsSecretName: 'bureau/auth0EmailProviderCreds',
    // TODO: Replace the from address after we get the email provider credentials from Bureau
    fromAddress: 'support@flagright.com',
  },
}
