import { WHITE_LABEL_ORIGINS } from '@lib/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './type'

export const Auth0SandboxRegtankTenantConfig: Auth0TenantConfig = {
  tenantName: 'sandbox-regtank-flagright',
  region: 'eu',
  customDomain: 'login.qc-staging.console.regtank.com',
  consoleApplicationName: 'Regtank Console (Sandbox)',
  consoleUrl: 'https://qc-staging.console.regtank.com',
  allowedOrigins: [WHITE_LABEL_ORIGINS.regtank.sandbox],
  allowedCallbackUrls: [WHITE_LABEL_ORIGINS.regtank.sandbox],
  branding: {
    // TODO: To be provided by Regtank
    logoUrl: 'https://i.imgur.com/WQtpTiA.png',
    primaryColor: '#00CC6A',
    pageBackgroundColor: '#EFF2F5',
    companyDisplayName: 'Regtank Technology Pte Ltd',
  },
  emailProvider: {
    type: 'ses',
    credentialsAwsSecretName: 'regtank/auth0EmailProviderCreds',
    // TBD
    fromAddress: 'support@regtank.com',
  },
  apiUsageGoogleSheetId: '12ceH3p0RjC4yBVykdl4LNlhym-y7K8D2qhVD0Q4_rgo',
}
