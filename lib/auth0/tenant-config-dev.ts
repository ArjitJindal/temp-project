import { DEV_GITHUB_USERS } from '../../bin/dev-github-users'
import { Auth0TenantConfig } from './tenant-config'

const allowedOrigins = [
  'https://flagright.local:8001',
  'http://localhost:8001',
  'https://localhost:8001',
  'https://dev.console.flagright.com',
  ...DEV_GITHUB_USERS.flatMap((user) => [
    `https://dev.${user}-1.console.flagright.com`,
    `https://dev.${user}-2.console.flagright.com`,
    `https://dev.${user}-3.console.flagright.com`,
  ]),
]
export const Auth0DevTenantConfig: Auth0TenantConfig = {
  tenantName: 'dev-flagright',
  region: 'eu',
  customDomain: 'login.dev.console.flagright.com',
  consoleApplicationName: 'Flagright Console (Dev)',
  consoleUrl: 'https://dev.console.flagright.com',
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
}
