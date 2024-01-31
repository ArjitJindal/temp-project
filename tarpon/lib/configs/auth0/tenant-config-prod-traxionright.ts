import { WHITE_LABEL_ORIGINS } from '@lib/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './type'

export const Auth0ProdTraxionRightTenantConfig: Auth0TenantConfig = {
  tenantName: 'traxionright-flagright',
  region: 'eu',
  customDomain: 'login.app.traxionright.com',
  consoleApplicationName: 'TraxionRight Console',
  consoleUrl: 'https://app.traxionright.com',
  allowedOrigins: [WHITE_LABEL_ORIGINS.traxionRight.prod],
  allowedCallbackUrls: [WHITE_LABEL_ORIGINS.traxionRight.prod],
  branding: {
    logoUrl: 'https://i.imgur.com/uG7lZJn.png',
    primaryColor: '#4169E0',
    pageBackgroundColor: '#EFF2F5',
    companyDisplayName: 'Traxion Right',
  },
  emailProvider: {
    type: 'sendgrid',
    credentialsAwsSecretName: 'traxionright/auth0EmailProviderCreds',
    fromAddress: 'noreply@traxionright.com',
  },
  apiUsageGoogleSheetId: '1tYmvUYCsbQVYTgqI7rEjW--uycww1prRu-CcERC_hMM',
}
