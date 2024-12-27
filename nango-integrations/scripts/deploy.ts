import { exec } from 'child_process'
import { getSecret } from '../utils/secrets'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils/env'
import { Env } from '@flagright/lib/constants/deploy'

// TODO: Move this to lib and have a single source of truth for this
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

export function envIs(...envs: Env[]) {
  return envs.some((env) => {
    if (env === 'local' && process.env.NODE_ENV === 'test') {
      return false
    }

    if (env === 'test') {
      return process.env.NODE_ENV === 'test'
    }

    if (!process.env.ENV) {
      // We don't know, return false to be safe.
      return false
    }
    return process.env.ENV.startsWith(env)
  })
}

export const execAsync = (enviroment: 'dev' | 'sandbox' | 'prod') => {
  return new Promise((resolve) => {
    exec(`nango deploy ${enviroment}`, (err, stdout, stderr) => {
      resolve({ err, stdout, stderr })
    })
  })
}

export const deploy = async () => {
  loadConfigEnv()
  const [stage, region] = stageAndRegion()
  process.env.ENV = stage
  process.env.REGION = region
  process.env.NANGO_DEPLOY_AUTO_CONFIRM = 'true'
  const secret = await getSecret<{
    apiKey: string
  }>('nango')

  if (envIs('local') || envIs('dev')) {
    process.env.NANGO_SECRET_KEY_DEV = secret.apiKey
    console.log(secret.apiKey)
    await execAsync('dev')
  } else if (envIs('sandbox')) {
    process.env.NANGO_SECRET_KEY_SANDBOX = secret.apiKey
    await execAsync('sandbox')
  } else if (envIs('prod')) {
    process.env.NANGO_SECRET_KEY_PROD = secret.apiKey
    await execAsync('prod')
  } else {
    throw new Error('Invalid environment')
  }
}

if (require.main === module) {
  void deploy()
}
