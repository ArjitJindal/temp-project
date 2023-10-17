import { WHITE_LABEL_ORIGINS } from '@lib/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './type'

export const Auth0SandboxZigramTenantConfig: Auth0TenantConfig = {
  tenantName: 'sandbox-zigram-flagright',
  region: 'eu',
  customDomain: 'login.sandboxconsole.transactcomply.com',
  consoleApplicationName: 'Transact Comply Console (Sandbox)',
  consoleUrl: 'https://sandboxconsole.transactcomply.com',
  allowedOrigins: [WHITE_LABEL_ORIGINS.zigram.sandbox],
  allowedCallbackUrls: [WHITE_LABEL_ORIGINS.zigram.sandbox],
  branding: {
    logoUrl: 'https://i.imgur.com/0OuS3UP.png',
    primaryColor: '#4169E0',
    pageBackgroundColor: '#EFF2F5',
    companyDisplayName: 'Transact Comply',
  },
  emailProvider: {
    type: 'ses',
    credentialsAwsSecretName: 'zigram/auth0EmailProviderCreds',
    fromAddress: 'tmsupport@zigram.tech',
  },
  apiUsageGoogleSheetId: '12ceH3p0RjC4yBVykdl4LNlhym-y7K8D2qhVD0Q4_rgo',
}
