import fetch from 'node-fetch'
import { getConfig } from '../../scripts/migrations/utils/config'
import { Config } from '../../lib/configs/config'
import { getAuth0Credentials } from '@/utils/auth0-utils'

const args = process.argv.slice(2)

let apiPrefix = ''
let tenantId = ''
const config = getConfig()
let auth0OrganizationName = ''
let tenantName = ''

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--apiPrefix')) {
    apiPrefix = args[i].split('=')[1]
  }

  if (args[i].startsWith('--tenantId')) {
    tenantId = args[i].split('=')[1]
  }

  if (args[i].startsWith('--auth0OrganizationName')) {
    auth0OrganizationName = args[i].split('=')[1]
  }

  if (args[i].startsWith('--tenantName')) {
    tenantName = args[i].split('=')[1]
  }
}

if (
  !apiPrefix ||
  !tenantId ||
  !auth0OrganizationName ||
  !tenantName ||
  !process.env.ENV
) {
  throw new Error(
    'Missing required argument. Please provide: --apiPrefix, --tenantId, --auth0OrganizationName, --tenantName, ENV'
  )
}

const createAuth0Organization = async (
  apiPrefix: string,
  tenantId: string,
  auth0OrganizationName: string,
  config: Config,
  tenantName: string
) => {
  const { clientId, clientSecret } = await getAuth0Credentials()

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
      name: tenantName.toLowerCase().replace(/ /g, '-'),
      display_name: auth0OrganizationName,
      metadata: {
        tenantId,
        consoleApiUrl: `https://${apiPrefix}.console.flagright.com/console`,
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
}

createAuth0Organization(
  apiPrefix,
  tenantId,
  auth0OrganizationName,
  config,
  tenantName
)
