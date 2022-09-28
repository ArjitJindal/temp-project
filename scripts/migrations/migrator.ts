import path from 'path'
import { exit } from 'process'
import { StackConstants } from '@cdk/constants'
import { Umzug, MongoDBStorage } from 'umzug'
import { syncMongoDbIndices } from './always-run/sync-mongodb-indices'
import { syncRulesLibrary } from './always-run/sync-rules-library'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

const MIGRATION_TEMPLATE = `export const up = async () => {
  // Put your migration code here
}
export const down = async () => {
  // Put your migration code for rolling back here. If not applicable, skip it.
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

if (process.env.ENV === 'local') {
  process.env.MONGO_URI = `mongodb://localhost:27017/${StackConstants.MONGO_DB_DATABASE_NAME}`
  process.env.DYNAMODB_URI = 'http://localhost:8000'
  process.env.AWS_REGION = 'local'
}

async function main() {
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

  await umzug.runAsCLI()

  if (migrationType === 'POST_DEPLOYMENT') {
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
