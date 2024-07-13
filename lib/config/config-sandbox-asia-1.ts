import { Config } from './config'
import { config as sandboxbaseConfig } from './config-sandbox-eu-1'

const account = '293986822825'
const region = 'ap-southeast-1'

export const config: Config = {
  ...sandboxbaseConfig,
  region: 'asia-1',
  env: { account, region },
  application: {
    ...sandboxbaseConfig.application,
    BETTERUPTIME_HOOK_URL:
      'https://uptime.betterstack.com/api/v1/aws-cloudwatch/webhook/8kuHsa8jtTLABtyTSv4Fu77d',
  },
}
