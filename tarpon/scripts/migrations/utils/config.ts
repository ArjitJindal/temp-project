import { getTarponConfig } from '@flagright/lib/constants/config'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'

export function getConfig() {
  if (!process.env.ENV) {
    process.env.ENV = 'local'
    console.warn("ENV unspecified. Using 'local'.")
  }
  const env = process.env.ENV as Stage
  return getTarponConfig(env, (process.env.REGION as FlagrightRegion) || 'eu-1')
}

export function loadConfigEnv() {
  const config = getConfig()
  Object.entries(config.application).forEach((entry) => {
    process.env[entry[0]] = String(entry[1])
  })
  process.env.ENV = config.stage
  process.env.REGION = config.region
  process.env.AWS_REGION = config.env.region
}
