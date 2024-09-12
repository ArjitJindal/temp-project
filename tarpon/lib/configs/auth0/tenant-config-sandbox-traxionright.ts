import { WHITE_LABEL_ORIGINS } from '@lib/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './type'

export const Auth0SandboxTraxionRightTenantConfig: Auth0TenantConfig = {
  tenantName: 'sandbox-traxionright-flagright',
  region: 'eu',
  customDomain: 'login.sitapp.traxionright.com',
  consoleApplicationName: 'TraxionRight Console (Sandbox)',
  consoleUrl: 'https://sitapp.traxionright.com',
  allowedOrigins: [WHITE_LABEL_ORIGINS.traxionRight.sandbox],
  allowedCallbackUrls: [WHITE_LABEL_ORIGINS.traxionRight.sandbox],
  branding: {
    logoUrl: 'https://imgur.com/uG7lZJn.png',
    primaryColor: '#4169E0',
    pageBackgroundColor: '#EFF2F5',
    companyDisplayName: 'TraxionRight',
  },
  emailProvider: {
    type: 'sendgrid',
    credentialsAwsSecretName: 'traxionright/auth0EmailProviderCreds',
    fromAddress: 'noreply@traxionright.com',
  },
  apiUsageGoogleSheetId: '1qlCOVIJkvJbZVV7w2s3sICll2gDjJip17pRvKSSTFlw',
  sessionTimeoutHours: 6,
  requireLoginAfterHours: 48,
}
