import fetch from 'node-fetch'
import commandLineArgs from 'command-line-args'
import { getConfig, loadConfigEnv } from '../../scripts/migrations/utils/config'
import { Config } from '../../lib/configs/config'
import { getAuth0Credentials } from '@/utils/auth0-utils'
import { AccountsService } from '@/lambdas/console-api-account/services/accounts-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

const config = getConfig()

type OptionsType = {
  apiPrefix: string
  tenantId: string
  auth0OrganizationName: string
  tenantName: string
  auth0Emails?: string
  featureFlags?: string
}

const optionDefinitions = [
  { name: 'apiPrefix', type: String },
  { name: 'tenantId', type: String },
  { name: 'auth0OrganizationName', type: String },
  { name: 'tenantName', type: String },
  { name: 'auth0Emails', type: String },
  { name: 'featureFlags', type: String },
]

const options = commandLineArgs(optionDefinitions)

if (
  !options.apiPrefix ||
  !options.tenantId ||
  !options.auth0OrganizationName ||
  !options.tenantName ||
  !process.env.ENV
) {
  throw new Error(
    'Missing required argument. Please provide: --apiPrefix, --tenantId, --auth0OrganizationName, --tenantName, ENV'
  )
}

loadConfigEnv()

const createAuth0Organization = async (
  options: OptionsType,
  config: Config
) => {
  const { clientId, clientSecret } = await getAuth0Credentials()

  const auth0Emails: Array<any> = options?.auth0Emails?.split(',') || []
  const featureFlags: Array<any> = options?.featureFlags?.split(',') || []
  const dynamoDb = getDynamoDbClient()
  const auth0Url = 'https://' + config.application.AUTH0_DOMAIN + '/oauth/token'
  const bearerTokenReq = await fetch(auth0Url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience: config.application.AUTH0_MANAGEMENT_API_AUDIENCE,
    }),
  })

  const bearerTokenResp: any = await bearerTokenReq.json()
  const bearerToken = bearerTokenResp.access_token as unknown as string

  const auth0OrganizationsUrl =
    config.application.AUTH0_MANAGEMENT_API_AUDIENCE + 'organizations'

  const auth0OrganizationReq = await fetch(auth0OrganizationsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({
      name: options.tenantName.toLowerCase().replace(/ /g, '-'),
      display_name: options.auth0OrganizationName,
      metadata: {
        tenantId: options.tenantId,
        consoleApiUrl: `https://${options.apiPrefix}api.flagright.com/console`,
        apiAudience: config.application.AUTH0_AUDIENCE,
      },
    }),
  })

  const auth0Organization: any = await auth0OrganizationReq.json()

  if (
    auth0Organization?.statusCode &&
    parseInt(auth0Organization.statusCode as unknown as string) >= 400
  ) {
    console.error(
      `Failed to create Auth0 organization: ${auth0Organization.message} (status code: ${auth0Organization.statusCode})`
    )
    return
  }

  console.log(
    `Auth0 organization created: ${auth0Organization.name} (id: ${auth0Organization.id})`
  )

  const accountsService = new AccountsService({
    AUTH0_CONSOLE_CLIENT_ID: clientId,
    AUTH0_DOMAIN: config.application.AUTH0_DOMAIN,
  })

  for (let i = 0; i < auth0Emails.length; i++) {
    const auth0Email = auth0Emails[i]
    if (
      !(typeof auth0Email === 'string') ||
      !auth0Email ||
      !auth0Email.includes('@') ||
      !auth0Email.includes('.')
    ) {
      continue
    }
    const account = await accountsService.createAccountInOrganization(
      {
        id: auth0Organization.metadata.tenantId,
        name: auth0Organization.name as unknown as string,
        apiAudience: auth0Organization.metadata
          .apiAudience as unknown as string,
        orgId: auth0Organization.id as unknown as string,
      },
      { email: auth0Email, role: 'admin' }
    )

    console.log(account)
  }

  const tenantRepository = new TenantRepository(options.tenantId, {
    dynamoDb,
  })

  await tenantRepository.createOrUpdateTenantSettings({
    features: featureFlags,
  })

  console.log('Tenant settings updated with feature flags ' + featureFlags)
}

createAuth0Organization(options as OptionsType, config)
