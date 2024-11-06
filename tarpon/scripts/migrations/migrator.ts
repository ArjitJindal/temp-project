process.env.AWS_XRAY_CONTEXT_MISSING = 'IGNORE_ERROR'
import path from 'path'
import { exit } from 'process'
import {
  SQSQueues,
  StackConstants,
  getNameForGlobalResource,
} from '@lib/constants'
import { Umzug, MongoDBStorage } from 'umzug'
import { STS, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { RuleInstanceService } from '../../src/services/rules-engine/rule-instance-service'
import { syncMongoDbIndexes } from './always-run/sync-mongodb-indexes'
import { getConfig, loadConfigEnv } from './utils/config'
import { syncListLibrary } from './always-run/sync-list-library'
import { migrateAllTenants, syncFeatureFlags } from './utils/tenant'
import { syncAccountsLocally } from './always-run/sync-accounts'
import { syncClickhouseTables } from './always-run/sync-clickhouse'
import { envIs } from '@/utils/env'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RuleService } from '@/services/rules-engine'
import { seedDemoData } from '@/core/seed'
import { getAuth0ManagementClient } from '@/utils/auth0-utils'
import { hasFeature } from '@/core/utils/context'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { PNB_INTERNAL_RULES } from '@/services/rules-engine/pnb-custom-logic'

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
  const batchJobQueueName: string = SQSQueues.BATCH_JOB_QUEUE_NAME.name
  const asyncRuleQueueName: string = SQSQueues.ASYNC_RULE_QUEUE_NAME.name
  const auditLogTopicName: string = StackConstants.AUDIT_LOG_TOPIC_NAME
  const mongoDbConsumerQueueName: string =
    SQSQueues.MONGO_DB_CONSUMER_QUEUE_NAME.name
  process.env.BATCH_JOB_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${batchJobQueueName}`
  process.env.AUDITLOG_TOPIC_ARN = `arn:aws:sns:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT}:${auditLogTopicName}`
  process.env.ASYNC_RULE_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${asyncRuleQueueName}`
  process.env.SHARED_ASSETS_BUCKET = getNameForGlobalResource(
    StackConstants.S3_SHARED_ASSETS_PREFIX,
    getConfig()
  )
  process.env.MONGO_DB_CONSUMER_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${mongoDbConsumerQueueName}`
}

async function main() {
  refreshCredentialsPeriodically()
  initializeEnvVars()
  const isMigrationFileCreation = process.argv.includes('create')

  if (process.argv.includes('sync')) {
    await syncData()
    return
  }

  if (
    migrationType !== 'PRE_DEPLOYMENT' &&
    migrationType !== 'POST_DEPLOYMENT'
  ) {
    throw new Error(`Unknown migration type: ${migrationType}`)
  }

  if (!isMigrationFileCreation && migrationType === 'POST_DEPLOYMENT') {
    console.info(`Sync data before POST_DEPLOYMENT step`)
    await syncData()
  }

  const directory =
    migrationType === 'PRE_DEPLOYMENT' ? 'pre-deployment' : 'post-deployment'
  const migrationCollection =
    migrationType === 'PRE_DEPLOYMENT'
      ? 'migrations-pre-deployment'
      : 'migrations-post-deployment'

  if (!isMigrationFileCreation && migrationType === 'PRE_DEPLOYMENT') {
    console.info('Syncing clickhouse tables before handling migrations')
    // Sync clickhouse tables before handling migrations
    await syncClickhouseTables()
  }

  const mongodb = await getMongoDbClient()
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

  if (!isMigrationFileCreation && migrationType === 'POST_DEPLOYMENT') {
    // Seed cypress tenant on dev
    if (envIs('dev')) {
      await seedDemoData('cypress-tenant')
      await cleanUpCypressTestAuth0Users()
    }
  }
}

async function cleanUpCypressTestAuth0Users() {
  const managementClient = await getAuth0ManagementClient(
    'dev-flagright.eu.auth0.com'
  )
  const userManager = managementClient.users
  const users = await userManager.getAll({
    q: 'email:test-cypress*',
  })
  for (const user of users.data) {
    if (user.email.startsWith('test-cypress')) {
      await userManager.delete({ id: user.user_id })
      console.info(`Deleted user: ${user.email}`)
    }
  }
}

async function syncData() {
  await syncMongoDbIndexes()
  await RuleService.syncRulesLibrary()
  await syncListLibrary()
  await syncFeatureFlags()
  await migrateAllTenants(async (tenant) => {
    await RuleInstanceService.migrateV2RuleInstancesToV8(tenant.id)
    if (hasFeature('PNB')) {
      const ruleInstanceService = new RuleInstanceService(tenant.id, {
        mongoDb: await getMongoDbClient(),
        dynamoDb: getDynamoDbClient(),
      })
      await Promise.all(
        PNB_INTERNAL_RULES.map((rule) =>
          ruleInstanceService.createOrUpdateRuleInstance(rule)
        )
      )
    }
  })
  if (envIs('local')) {
    await syncAccountsLocally()
  }
}

main()
  .then(() => exit(0))
  .catch((e) => {
    console.error(e)
    exit(1)
  })
