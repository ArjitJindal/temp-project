import { exit } from 'process'
import commandLineArgs from 'command-line-args'
import { render } from 'prettyjson'
import { Db } from 'mongodb'
import { isEmpty } from 'lodash'
import { getConfig, loadConfigEnv } from './migrations/utils/config'
import { TenantService } from '@/services/tenants'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Env, PRODUCTION_ENVS } from '@/utils/env'

async function runReadOnlyQueryForTenant(
  _mongoDb: Db,
  _tenantId: string
): Promise<any> {
  /**
   * Put your READ-ONLY query below and return a printable object
   * e.g
   * const result = await mongoDb
   *  .collection<InternalUser>(USERS_COLLECTION(tenantId))
   *  .find({})
   *  .limit(1)
   * return await result.toArray()
   */

  return { Hello: 'World' }
}

const optionDefinitions = [{ name: 'env', type: String }]
const options = commandLineArgs(optionDefinitions)
if (!['dev', 'sandbox', 'prod'].includes(options.env)) {
  console.error(`Allowed --env options: dev, sandbox prod`)
  exit(1)
}

async function runReadOnlyQueryForEnv(env: Env) {
  process.env.ENV = env
  loadConfigEnv()
  const config = getConfig()
  const mongoDb = await getMongoDbClientDb(false)
  const tenantInfos = await TenantService.getAllTenants(
    config.stage,
    config.region
  )

  for (const tenant of tenantInfos) {
    const result = await runReadOnlyQueryForTenant(mongoDb, tenant.tenant.id)
    if (!isEmpty(result)) {
      console.info(
        `\nTenant: ${tenant.tenant.name} (ID: ${tenant.tenant.id}) (region: ${tenant.tenant.region})`
      )
      console.log(render(result))
    }
  }
}

async function main() {
  if (options.env === 'dev') {
    await runReadOnlyQueryForEnv('dev')
  } else if (options.env === 'sandbox') {
    await runReadOnlyQueryForEnv('sandbox')
  } else if (options.env === 'prod') {
    for (const env of PRODUCTION_ENVS) {
      await runReadOnlyQueryForEnv(env)
    }
  }
}

void main()
  .then(() => exit(0))
  .catch((e) => {
    console.error(e)
    exit(1)
  })
