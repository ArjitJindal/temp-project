import { config as localConfig } from '@cdk/configs/config-local'
import { config as devConfig } from '@cdk/configs/config-dev'
import { config as sandboxConfig } from '@cdk/configs/config-sandbox'
import { config as prodConfigAsia2 } from '@cdk/configs/config-prod-asia-2'
import { config as prodConfigAsia1 } from '@cdk/configs/config-prod-asia-1'
import { config as prodConfigEu1 } from '@cdk/configs/config-prod-eu-1'

export function getConfig() {
  if (!process.env.ENV) {
    throw new Error('Env var missing: ENV')
  }
  switch (process.env.ENV) {
    case 'local':
      return localConfig
    case 'dev':
      return devConfig
    case 'sandbox':
      return sandboxConfig
    case 'prod:asia-1':
      return prodConfigAsia1
    case 'prod:asia-2':
      return prodConfigAsia2
    case 'prod:eu-1':
      return prodConfigEu1
    default:
      throw new Error(`Unknown env: ${process.env.ENV}`)
  }
}
