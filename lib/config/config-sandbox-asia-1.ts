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
    MONGO_ATLAS_CLUSTER: 'Sandbox-SIN',
    BETTERUPTIME_HOOK_URL:
      'https://uptime.betterstack.com/api/v1/aws-cloudwatch/webhook/8kuHsa8jtTLABtyTSv4Fu77d',
    ZENDUTY_WEBHOOK_URL:
      'https://events.zenduty.com/integration/ro7ie/cloudwatch_v2/6830cfb2-8a0f-4f28-81af-06e2e74e7042/',
    MONGO_EVENT_TRIGGER_RULE_ID: '66ed4f296781e98cf16e7dad',
  },
  resource: {
    ...sandboxbaseConfig.resource,
  },
  clickhouse: {
    awsPrivateLinkEndpointName:
      'com.amazonaws.vpce.ap-southeast-1.vpce-svc-0a2b4df11b06e4872',
  },
}
