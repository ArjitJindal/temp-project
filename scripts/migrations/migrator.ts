import path from 'path'
import { exit } from 'process'
import { StackConstants } from '@lib/constants'
import { Umzug, MongoDBStorage } from 'umzug'
import AWS from 'aws-sdk'
import { syncMongoDbIndices } from './always-run/sync-mongodb-indices'
import { syncRulesLibrary } from './always-run/sync-rules-library'
import { loadConfigEnv } from './utils/config'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

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
if (process.env.ENV === 'local') {
  process.env.AWS_REGION = 'local'
}

function refreshCredentialsPeriodically() {
  // Refresh the AWS credentials before it expires (1 hour). We're using role chaining to
  // assume a cross-account role in deployment and the max session duration is 1 hour.
  setInterval(
    async () => {
      try {
        const sts = new AWS.STS()
        const assumeRoleResult = await sts
          .assumeRole({
            RoleArn: process.env.ASSUME_ROLE_ARN as string,
            RoleSessionName: 'migration',
          })
          .promise()
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

async function main() {
  refreshCredentialsPeriodically()

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

  if (migrationType === 'POST_DEPLOYMENT' && !process.argv.includes('create')) {
    await syncMongoDbIndices()
    await syncRulesLibrary()
  }
}

main()
  .then(() => exit(0))
  .catch((e) => {
    console.error(e)
    exit(1)
  })
