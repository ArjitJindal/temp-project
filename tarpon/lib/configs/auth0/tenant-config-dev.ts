import { Auth0TenantConfig } from './type'

const allowedOrigins = [
  'https://flagright.local:8001',
  'http://localhost:8001',
  'https://localhost:8001',
  'https://console.flagright.dev',
  `https://*.console.flagright.dev`,
]
export const Auth0DevTenantConfig: Auth0TenantConfig = {
  tenantName: 'dev-flagright',
  region: 'eu',
  customDomain: 'login.console.flagright.dev',
  consoleApplicationName: 'Flagright Console (Dev)',
  consoleUrl: 'https://console.flagright.dev',
  allowedOrigins,
  allowedCallbackUrls: allowedOrigins,
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
  sessionTimeoutHours: 6,
  requireLoginAfterHours: 48,
}
