import * as fs from 'fs'
import { Fn } from 'cdktf'
import { Construct } from 'constructs'
import * as aws from '@cdktf/providers/aws'
import * as auth0 from '@cdktf/providers/auth0'

import { Config } from '@lib/configs/config'
import { Auth0TenantConfig } from '@lib/configs/auth0/type'
import { PERMISSIONS } from '@/@types/openapi-internal-custom/Permission'
import { DEFAULT_ROLES } from '@/core/default-roles'
import { getAuth0Domain } from '@/utils/auth0-utils'

function getTenantResourceId(tenantName: string, id: string) {
  return `${tenantName}::${id}`
}

function getSecrets<T>(
  context: Construct,
  config: Config,
  tenantName: string,
  awsSecretName: string,
  secretFields: string[]
) {
  const secretVersion =
    new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
      context,
      getTenantResourceId(tenantName, awsSecretName),
      {
        secretId: `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:${awsSecretName}`,
      }
    )
  const secrets: any = {}
  for (const secretField of secretFields) {
    const secret = Fn.lookup(
      Fn.jsondecode(secretVersion.secretString),
      secretField,
      ''
    )
    secrets[secretField] = secret
  }
  return secrets as T
}

export const createAuth0TenantResources = (
  context: Construct,
  config: Config,
  tenantConfig: Auth0TenantConfig
) => {
  /**
   * Setup
   */
  const { tenantName, region } = tenantConfig
  const auth0Creds = getSecrets<{ clientId: string; clientSecret: string }>(
    context,
    config,
    tenantConfig.tenantName,
    getAuth0Domain(tenantConfig.tenantName, tenantConfig.region),
    ['clientId', 'clientSecret']
  )
  const provider = new auth0.provider.Auth0Provider(
    context,
    getTenantResourceId(tenantName, 'auth0'),
    {
      alias: tenantName,
      domain: `${tenantName}.${region}.auth0.com`,
      audience: `https://${tenantName}.${region}.auth0.com/api/v2/`,
      clientId: auth0Creds.clientId,
      clientSecret: auth0Creds.clientSecret,
    }
  )

  /**
   * Applications::Applications
   */
  new auth0.client.Client(context, getTenantResourceId(tenantName, 'console'), {
    provider,
    name: tenantConfig.consoleApplicationName,
    appType: 'spa',
    callbacks: tenantConfig.allowedCallbackUrls,
    allowedOrigins: tenantConfig.allowedOrigins,
    allowedLogoutUrls: tenantConfig.allowedOrigins,
    webOrigins: tenantConfig.allowedOrigins,
    oidcConformant: true,
    tokenEndpointAuthMethod: 'none',
    grantTypes: ['authorization_code', 'implicit', 'password', 'refresh_token'],
    jwtConfiguration: {
      alg: 'RS256',
    },
    clientMetadata: {
      isConsole: 'true',
    },
    refreshToken: {
      leeway: 0,
      idleTokenLifetime: 60 * 60,
      tokenLifetime: 8 * 60 * 60,
      rotationType: 'rotating',
      expirationType: 'expiring',
    },
    logoUri: tenantConfig.branding.logoUrl,
    initiateLoginUri: tenantConfig.consoleUrl,
  })

  /**
   * Applications::APIs
   */
  new auth0.resourceServer.ResourceServer(
    context,
    getTenantResourceId(tenantName, `api-gateway-`),
    {
      provider,
      name: `APIGateway (api)`,
      identifier: config.application.AUTH0_AUDIENCE,
      signingAlg: 'RS256',
      allowOfflineAccess: false,
      tokenLifetime: 86400,
      tokenLifetimeForWeb: 7200,
      skipConsentForVerifiableFirstPartyClients: true,
      enforcePolicies: true,
      tokenDialect: 'access_token_authz',
      scopes: PERMISSIONS.map((p) => {
        return {
          description: p,
          value: p,
        }
      }),
    }
  )

  /**
   * User Management::Roles
   */
  DEFAULT_ROLES.map(
    ({ role, permissions, description }) =>
      new auth0.role.Role(context, getTenantResourceId(tenantName, role), {
        provider,
        name: `default:${role}`,
        permissions: permissions.map((p) => ({
          name: p,
          resourceServerIdentifier: config.application.AUTH0_AUDIENCE,
        })),
        description,
      })
  )

  // Root
  new auth0.role.Role(context, getTenantResourceId(tenantName, `root`), {
    provider,
    name: `root`,
    permissions: PERMISSIONS.map((p) => ({
      name: p,
      resourceServerIdentifier: config.application.AUTH0_AUDIENCE,
    })),
  })

  /**
   * Branding::Custom Domains
   */
  if (!tenantConfig.customDomain.includes('auth0.com')) {
    new auth0.customDomain.CustomDomain(
      context,
      getTenantResourceId(tenantName, 'custom-domain'),
      {
        provider,
        domain: tenantConfig.customDomain,
        type: 'auth0_managed_certs',
      }
    )
  }

  /**
   * Actions::Library::Custom
   */
  const postLoginCode = fs.readFileSync(
    'infra/auth0/actions/post-login.js',
    'utf8'
  )
  const postLoginAction = new auth0.action.Action(
    context,
    getTenantResourceId(tenantName, 'post-login'),
    {
      provider,
      code: postLoginCode,
      name: 'Add user metadata to tokens',
      supportedTriggers: {
        id: 'post-login',
        version: 'v3',
      },
      runtime: 'node16',
      deploy: true,
      secrets: [
        { name: 'domain', value: `${tenantName}.${region}.auth0.com` },
        { name: 'clientId', value: auth0Creds.clientId },
        { name: 'clientSecret', value: auth0Creds.clientSecret },
      ],
      dependencies: [
        {
          name: 'auth0',
          version: '2.42.0',
        },
      ],
    }
  )

  /**
   * Actions::Flows
   */
  new auth0.triggerBinding.TriggerBinding(
    context,
    getTenantResourceId(tenantName, 'login-flow'),
    {
      provider,
      trigger: 'post-login',
      actions: [{ displayName: postLoginAction.name, id: postLoginAction.id }],
    }
  )

  /**
   * Branding::Universal Login
   */
  new auth0.branding.Branding(
    context,
    getTenantResourceId(tenantName, 'branding'),
    {
      provider,
      logoUrl: tenantConfig.branding.logoUrl,
      colors: {
        primary: tenantConfig.branding.primaryColor,
        pageBackground: tenantConfig.branding.pageBackgroundColor,
      },
    }
  )
  new auth0.prompt.Prompt(context, getTenantResourceId(tenantName, 'prompt'), {
    provider,
    universalLoginExperience: 'new',
  })
  new auth0.promptCustomText.PromptCustomText(
    context,
    getTenantResourceId(tenantName, 'prompt-custom-text-login-en'),
    {
      provider,
      prompt: 'login',
      language: 'en',
      body: Fn.jsonencode({
        login: {
          alertListTitle: 'Alerts',
          buttonText: 'Continue',
          description: 'Log in to continue to ${clientName}.',
          editEmailText: 'Edit',
          emailPlaceholder: 'Email address',
          federatedConnectionButtonText: 'Continue with ${connectionName}',
          footerLinkText: 'Sign up',
          footerText: "Don't have an account?",
          forgotPasswordText: 'Forgot password?',
          invitationDescription:
            "Log in to accept ${inviterName}'s invitation to join ${clientName}.",
          invitationTitle: "You've Been Invited!",
          logoAltText: '${companyName}',
          pageTitle: 'Log in | ${clientName}',
          passwordPlaceholder: 'Password',
          separatorText: 'Or',
          signupActionLinkText: '${footerLinkText}',
          signupActionText: '${footerText}',
          title: 'Welcome',
          usernamePlaceholder: 'Username or email address',
        },
      }),
    }
  )

  /**
   * Branding::Email Provider
   */
  const getEmailCredentialsFields = () => {
    switch (tenantConfig.emailProvider.type) {
      case 'sendgrid':
        return ['apiKey']
      default:
        return []
    }
  }
  const emailCreds = getSecrets(
    context,
    config,
    tenantConfig.tenantName,
    tenantConfig.emailProvider.credentialsAwsSecretName,
    getEmailCredentialsFields()
  ) as any
  const emailProvider = new auth0.email.Email(
    context,
    getTenantResourceId(tenantName, 'email-provider'),
    {
      provider,
      name: tenantConfig.emailProvider.type,
      enabled: true,
      defaultFromAddress: tenantConfig.emailProvider.fromAddress,
      credentials: emailCreds,
    }
  )

  /**
   * Branding::Email Templates
   */
  const verifyEmailTemplate = fs.readFileSync(
    'infra/auth0/email-templates/verify-email-template.html',
    'utf8'
  )
  new auth0.emailTemplate.EmailTemplate(
    context,
    getTenantResourceId(tenantName, 'verify-email-template'),
    {
      provider,
      dependsOn: [emailProvider],
      enabled: true,
      template: 'verify_email',
      syntax: 'liquid',
      body: verifyEmailTemplate
        .replace(/{{console_name}}/g, tenantConfig.consoleApplicationName)
        .replace(/{{company_name}}/g, tenantConfig.branding.companyDisplayName)
        .replace(/{{logo_url}}/g, tenantConfig.branding.logoUrl),
      from: `${tenantConfig.consoleApplicationName} <${tenantConfig.emailProvider.fromAddress}>`,
      subject: `You have been invited to join ${tenantConfig.consoleApplicationName}. Please verify your email`,
      resultUrl: tenantConfig.consoleUrl,
    }
  )
  const changePasswordTemplate = fs.readFileSync(
    'infra/auth0/email-templates/change-password-template.html',
    'utf8'
  )
  new auth0.emailTemplate.EmailTemplate(
    context,
    getTenantResourceId(tenantName, 'change-password-template'),
    {
      provider,
      dependsOn: [emailProvider],
      enabled: true,
      template: 'reset_email',
      syntax: 'liquid',
      body: changePasswordTemplate
        .replace(/{{console_name}}/g, tenantConfig.consoleApplicationName)
        .replace(/{{company_name}}/g, tenantConfig.branding.companyDisplayName)
        .replace(/{{logo_url}}/g, tenantConfig.branding.logoUrl),
      from: `${tenantConfig.consoleApplicationName} <${tenantConfig.emailProvider.fromAddress}>`,
      subject: `Set your new password`,
      resultUrl: tenantConfig.consoleUrl,
    }
  )
}
