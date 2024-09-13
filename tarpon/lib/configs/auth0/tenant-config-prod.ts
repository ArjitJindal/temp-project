import { ALLOWED_ORIGINS } from '@lib/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './type'

export const Auth0ProdTenantConfig: Auth0TenantConfig = {
  tenantName: 'flagright',
  region: 'eu',
  customDomain: 'login.console.flagright.com',
  consoleApplicationName: 'Flagright Console',
  consoleUrl: 'https://console.flagright.com',
  allowedOrigins: ALLOWED_ORIGINS.prod,
  allowedCallbackUrls: ALLOWED_ORIGINS.prod,
  branding: {
    logoUrl:
      'https://lh6.googleusercontent.com/tocqbH_zqQ_iBpNofXXCz_3OkzXjhiTELkjUwr6JkZe-9uDy346lRr5oE28W5uARzRE=w2400',
    primaryColor: '#1168F9',
    pageBackgroundColor: '#EFF2F5',
    companyDisplayName: 'Flagright Data Technologies Inc.',
  },
  emailProvider: {
    type: 'sendgrid',
    credentialsAwsSecretName: 'auth0EmailProviderCreds',
    fromAddress: 'support@flagright.com',
  },
  sessionTimeoutHours: 1,
  requireLoginAfterHours: 48,
}
