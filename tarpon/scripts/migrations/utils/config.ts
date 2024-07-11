import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils/env'

export function getConfig() {
  if (!process.env.ENV) {
    process.env.ENV = 'local'
    console.warn("ENV unspecified. Using 'local'.")
  }
  const [stage, region] = stageAndRegion()
  return getTarponConfig(stage, region)
}

export function loadConfigEnv() {
  const config = getConfig()
  Object.entries(config.application).forEach((entry) => {
    process.env[entry[0]] = String(entry[1])
  })
  process.env.ENV = `${config.stage}:${config.region || 'eu-1'}`
  process.env.REGION = config.region
  process.env.AWS_REGION = config.env.region
  process.env.AWS_ACCOUNT = config.env.account
}
