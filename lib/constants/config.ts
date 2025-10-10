import { config as devConfig } from '../config/config-dev'
import { config as sandboxConfigEu1 } from '../config/config-sandbox-eu-1'
import { config as sandboxConfigAsia1 } from '../config/config-sandbox-asia-1'
import { config as prodConfigAsia1 } from '../config/config-prod-asia-1'
import { config as prodConfigAsia2 } from '../config/config-prod-asia-2'
import { config as prodConfigAsia3 } from '../config/config-prod-asia-3'
import { config as prodConfigEu1 } from '../config/config-prod-eu-1'
import { config as prodConfigEu2 } from '../config/config-prod-eu-2'
import { config as prodConfigUs1 } from '../config/config-prod-us-1'
import { config as prodConfigAu1 } from '../config/config-prod-au-1'
import { config as prodConfigMe1 } from '../config/config-prod-me-1'
import { config as localConfig } from '../config/config-local'
import { Config } from '../config/config'

export const CONFIG_MAP = {
  test: {
    'eu-1': localConfig,
  },
  deploy: {},
  local: {
    'eu-1': localConfig,
  },
  dev: {
    'eu-1': devConfig,
  },
  sandbox: {
    'asia-1': sandboxConfigAsia1,
    'eu-1': sandboxConfigEu1,
  },
  prod: {
    'asia-1': prodConfigAsia1,
    'asia-2': prodConfigAsia2,
    'asia-3': prodConfigAsia3,
    'eu-1': prodConfigEu1,
    'eu-2': prodConfigEu2,
    'us-1': prodConfigUs1,
    'au-1': prodConfigAu1,
    'me-1': prodConfigMe1,
  },
}

export function getTarponConfig(stage: string, region: string): Config {
  if (region === 'user') {
    return devConfig
  }
  // Ignored as we already throw an exception when not valid, and the typing doesn't compute.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const cfg = CONFIG_MAP[stage ?? 'local']?.[region]
  if (!cfg) {
    throw new Error(`No config found for stage: ${stage} and region: ${region}`)
  }
  return cfg
}
