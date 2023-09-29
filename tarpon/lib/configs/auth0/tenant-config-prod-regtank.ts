import { WHITE_LABEL_ORIGINS } from '@lib/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './type'

export const Auth0ProdRegtankTenantConfig: Auth0TenantConfig = {
  tenantName: 'regtank-flagright',
  region: 'eu',
  customDomain: 'login.transaction.console.regtank.com',
  consoleApplicationName: 'Regtank Console',
  consoleUrl: 'https://transaction.console.regtank.com',
  allowedOrigins: [WHITE_LABEL_ORIGINS.regtank.prod],
  allowedCallbackUrls: [WHITE_LABEL_ORIGINS.regtank.prod],
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
  apiUsageGoogleSheetId: '18LIRbs8wfkTYtkx7S1Ux-s_Gyw2DiswrkAeRZOi19OI',
}
