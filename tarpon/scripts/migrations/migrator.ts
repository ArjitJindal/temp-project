process.env.AWS_XRAY_CONTEXT_MISSING = 'IGNORE_ERROR'
import path from 'path'
import { exit } from 'process'
import { SQSQueues, StackConstants } from '@lib/constants'
import { Umzug, MongoDBStorage } from 'umzug'
import { STS, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { syncMongoDbIndices } from './always-run/sync-mongodb-indices'
import { syncRulesLibrary } from './always-run/sync-rules-library'
import { loadConfigEnv } from './utils/config'
import { syncListLibrary } from './always-run/sync-list-library'
import { syncFeatureFlags } from './utils/tenant'
import { envIs } from '@/utils/env'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { seedDynamo } from '@/core/seed/dynamodb'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { seedMongo } from '@/core/seed/mongo'

const MIGRATION_TEMPLATE = `import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
`

type MigrationType = 'PRE_DEPLOYMENT' | 'POST_DEPLOYMENT'
const migrationType = process.env.MIGRATION_TYPE as MigrationType
if (migrationType !== 'PRE_DEPLOYMENT' && migrationType != 'POST_DEPLOYMENT') {
  throw new Error(`Unknown migration type: ${migrationType}`)
}
const directory =
  migrationType === 'PRE_DEPLOYMENT' ? 'pre-deployment' : 'post-deployment'
const migrationCollection =
  migrationType === 'PRE_DEPLOYMENT'
    ? 'migrations-pre-deployment'
    : 'migrations-post-deployment'

loadConfigEnv()

function refreshCredentialsPeriodically() {
  // Refresh the AWS credentials before it expires (1 hour). We're using role chaining to
  // assume a cross-account role in deployment and the max session duration is 1 hour.
  setInterval(
    async () => {
      try {
        const sts = new STS({
          region: process.env.AWS_REGION,
        })

        const assumeRoleCommand = new AssumeRoleCommand({
          RoleArn: process.env.ASSUME_ROLE_ARN as string,
          RoleSessionName: 'migration',
        })

        const assumeRoleResult = await sts.send(assumeRoleCommand)

        process.env.AWS_ACCESS_KEY_ID =
          assumeRoleResult.Credentials?.AccessKeyId
        process.env.AWS_SECRET_ACCESS_KEY =
          assumeRoleResult.Credentials?.SecretAccessKey
        process.env.AWS_SESSION_TOKEN =
          assumeRoleResult.Credentials?.SessionToken
        console.info('Refreshed AWS credentials')
      } catch (e) {
        console.error('Failed to refresh AWS credentials')
        console.error(e)
      }
    },
    // 30 minutes
    30 * 60 * 1000
  )
}

function initializeEnvVars() {
  process.env.BATCH_JOB_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${SQSQueues.BATCH_JOB_QUEUE_NAME}`
  process.env.AUDITLOG_TOPIC_ARN = `arn:aws:sns:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT}:${StackConstants.AUDIT_LOG_TOPIC_NAME}`
}

async function main() {
  refreshCredentialsPeriodically()
  initializeEnvVars()

  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const umzug = new Umzug({
    migrations: {
      glob: [`${directory}/*.ts`, { cwd: __dirname }],
    },
    storage: new MongoDBStorage({
      connection: mongodb,
      collection: mongodb.db().collection(migrationCollection),
    }),
    logger: console,
    create: {
      template: (filePath) => [[filePath, MIGRATION_TEMPLATE]],
      folder: path.join(__dirname, directory),
    },
  })

  const success = await umzug.runAsCLI()
  if (!success) {
    exit(1)
  }

  if (process.argv.includes('create')) {
    return
  }

  if (migrationType === 'POST_DEPLOYMENT') {
    await syncMongoDbIndices()
    await syncRulesLibrary()
    await syncListLibrary()
    await syncFeatureFlags()

    // Seed cypress tenant on dev
    if (envIs('dev')) {
      const tenant = 'cypress-tenant'
      console.info('Seeding DynamoDB...')
      await seedDynamo(getDynamoDbClient(), tenant)

      console.info('Seeding MongoDB...')
      const client = await getMongoDbClient()
      await seedMongo(client, tenant)
      await client.close()
    }
  }
}

main()
  .then(() => exit(0))
  .catch((e) => {
    console.error(e)
    exit(1)
  })
