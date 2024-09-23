import { Config } from './config'
import { config as sandboxbaseConfig } from './config-sandbox-eu-1'

const account = '293986822825'
const region = 'ap-southeast-1'

export const config: Config = {
  ...sandboxbaseConfig,
  region: 'asia-1',
  env: { account, region },
  budgets: {
    CLOUDWATCH: 200,
    DYNAMODB: 10,
    LAMBDA: 250,
    S3: 20,
    SQS: 10,
    EC2: 200,
    GUARDDUTY: 30,
    KINESIS: 40,
    SECRETS_MANAGER: 15,
    VPC: 20,
    EMR: 100,
    GLUE: 30,
  },
  application: {
    ...sandboxbaseConfig.application,
    MONGO_ATLAS_CLUSTER: 'Sandbox-SIN',
    BETTERUPTIME_HOOK_URL:
      'https://uptime.betterstack.com/api/v1/aws-cloudwatch/webhook/8kuHsa8jtTLABtyTSv4Fu77d',
    MONGO_EVENT_TRIGGER_RULE_ID: '66ed4f296781e98cf16e7dad',
  },
  clickhouse: {
    privateEndpoint: {
      awsPrivateLinkEndpointName:
        'com.amazonaws.vpce.ap-southeast-1.vpce-svc-0a2b4df11b06e4872',
    },
    enabled: true,
  },
}
