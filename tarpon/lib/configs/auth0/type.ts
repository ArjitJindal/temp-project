export type Auth0TenantConfig = {
  tenantName: string
  region: 'eu'
  customDomain: string
  consoleApplicationName: string
  consoleUrl: string
  allowedOrigins: string[]
  allowedCallbackUrls: string[]
  branding: {
    logoUrl: string
    primaryColor: string
    pageBackgroundColor: string
    companyDisplayName: string
  }
  emailProvider: {
    type: 'sendgrid'
    credentialsAwsSecretName: string
    fromAddress: string
  }
}
