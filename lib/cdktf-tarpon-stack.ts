import * as fs from 'fs'
import { Fn, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import * as cdktf from 'cdktf'
import * as aws from '@cdktf/providers/aws'
import * as auth0 from '@cdktf/providers/auth0'
import { Config } from '@cdk/configs/config'
import { PERMISSIONS } from '@/@types/openapi-internal-custom/Permission'
import { DEFAULT_ROLES } from '@/core/default-roles'

export class CdktfTarponStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id)

    const awsRegion = config.env.region as string
    const stateBucket = `flagright-terraform-state-${config.stage}`

    // AWS
    new cdktf.S3Backend(this, {
      bucket: stateBucket,
      key: config.stage,
      region: awsRegion,
    })
    new aws.provider.AwsProvider(this, awsRegion, {
      region: awsRegion,
    })
    const state = new aws.s3Bucket.S3Bucket(this, 'tfstate', {
      bucket: stateBucket,
    })
    new aws.s3BucketAcl.S3BucketAcl(this, 'tfstate-acl', {
      bucket: state.bucket,
      acl: 'private',
    })

    // Auth0
    const auth0SecretVersion =
      new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
        this,
        `auth0_client_secret-version`,
        {
          secretId: config.application.AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN,
        }
      )

    const auth0ClientId = Fn.lookup(
      Fn.jsondecode(auth0SecretVersion.secretString),
      'clientId',
      ''
    )
    const auth0ClientSecret = Fn.lookup(
      Fn.jsondecode(auth0SecretVersion.secretString),
      'clientSecret',
      ''
    )
    new auth0.provider.Auth0Provider(auth0SecretVersion, 'auth0', {
      domain: config.application.AUTH0_DOMAIN,
      audience: config.application.AUTH0_MANAGEMENT_API_AUDIENCE,
      clientId: auth0ClientId,
      clientSecret: auth0ClientSecret,
    })

    // TODO split out into modules to avoid if == prod statements
    let identifiers: string[] = [`${process.env.ENV as string}.api`]
    if (process.env.ENV?.startsWith('prod')) {
      identifiers = ['api', 'asia-1.api', 'asia-2.api', 'eu-1.api', 'us-1.api']
    }

    const scopes = PERMISSIONS.map((p) => {
      return {
        description: p,
        value: p,
      }
    })
    const resourceIdentifiers = identifiers.map((identifier) => {
      const apiGateway = new auth0.resourceServer.ResourceServer(
        this,
        `api-gateway-${identifier}`,
        {
          name: `APIGateway (${identifier})`,
          identifier: `https://${identifier}.flagright.com/`,
          signingAlg: 'RS256',
          allowOfflineAccess: false,
          tokenLifetime: 86400,
          tokenLifetimeForWeb: 7200,
          skipConsentForVerifiableFirstPartyClients: true,
          enforcePolicies: true,
          tokenDialect: 'access_token_authz',
          scopes,
        }
      )
      return apiGateway.identifier
    })
    DEFAULT_ROLES.map(
      ({ role, permissions }) =>
        new auth0.role.Role(this, role, {
          name: `default:${role}`,
          permissions: resourceIdentifiers.flatMap(
            (resourceServerIdentifier) => {
              return permissions.map((p) => ({
                name: p,
                resourceServerIdentifier,
              }))
            }
          ),
        })
    )

    // Root
    new auth0.role.Role(this, 'root', {
      name: `root`,
      permissions: resourceIdentifiers.flatMap((resourceServerIdentifier) => {
        return PERMISSIONS.map((p) => ({
          name: p,
          resourceServerIdentifier,
        }))
      }),
    })

    const postLoginCode = fs.readFileSync('lib/auth0/post-login.js', 'utf8')

    new auth0.action.Action(this, 'post-login', {
      code: postLoginCode,
      name: 'Add user metadata to tokens',
      supportedTriggers: {
        id: 'post-login',
        version: 'v3',
      },
      runtime: 'node18',
      deploy: true,
      secrets: [
        { name: 'domain', value: config.application.AUTH0_DOMAIN },
        { name: 'clientId', value: auth0ClientId },
        { name: 'clientSecret', value: auth0ClientSecret },
      ],
      dependencies: [
        {
          name: 'auth0',
          version: '2.42.0',
        },
      ],
    })
  }
}
