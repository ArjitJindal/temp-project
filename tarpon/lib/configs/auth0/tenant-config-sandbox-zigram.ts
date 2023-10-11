import { WHITE_LABEL_ORIGINS } from '@lib/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './type'

export const Auth0SandboxZigramTenantConfig: Auth0TenantConfig = {
  tenantName: 'sandbox-zigram-flagright',
  region: 'eu',
  customDomain: 'login.sandboxconsole.transactcomply.com',
  consoleApplicationName: 'Zigram Console (Sandbox)',
  consoleUrl: 'https://sandboxconsole.transactcomply.com',
  allowedOrigins: [WHITE_LABEL_ORIGINS.zigram.sandbox],
  allowedCallbackUrls: [WHITE_LABEL_ORIGINS.zigram.sandbox],
  branding: {
    // TODO: To be provided by Zigram
    logoUrl: 'https://i.imgur.com/WQtpTiA.png',
    primaryColor: '#00CC6A',
    pageBackgroundColor: '#EFF2F5',
    companyDisplayName: 'Zigram',
  },
  emailProvider: {
    type: 'ses',
    credentialsAwsSecretName: 'zigram/auth0EmailProviderCreds',
    fromAddress: 'tmsupport@zigram.tech',
  },
  apiUsageGoogleSheetId: '12ceH3p0RjC4yBVykdl4LNlhym-y7K8D2qhVD0Q4_rgo',
}
