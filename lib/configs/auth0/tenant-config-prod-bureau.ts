import { WHITE_LABEL_ORIGINS } from '@lib/openapi/openapi-internal-constants'
import { Auth0TenantConfig } from './type'

export const Auth0ProdBureauTenantConfig: Auth0TenantConfig = {
  tenantName: 'bureau-flagright',
  region: 'eu',
  customDomain: 'login.tm.bureau.id',
  consoleApplicationName: 'Bureau Console',
  consoleUrl: 'https://tm.bureau.id',
  allowedOrigins: [WHITE_LABEL_ORIGINS.bureau.prod],
  allowedCallbackUrls: [
    WHITE_LABEL_ORIGINS.bureau.prod,
    `${WHITE_LABEL_ORIGINS.bureau.prod}/dashboard/analysis`,
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
