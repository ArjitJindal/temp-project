/**
 * Asia Pacific (Mumbai)
 * (Full list of regions: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
 */

import { ADMIN_EMAILS } from '../constants'
import { Config } from './config'
import { config as configProdEu2 } from './config-prod-eu-2'

const account = '870721492449'
const region = 'ap-south-1'

export const config: Config = {
  stage: 'prod',
  region: 'asia-2',
  env: { account, region },
  budgets: {
    CLOUDWATCH: 400,
    DYNAMODB: 130,
    LAMBDA: 500,
    S3: 20,
    SQS: 10,
    EC2: 220,
    GUARDDUTY: 20,
    KINESIS: 70,
    SECRETS_MANAGER: 15,
    VPC: 20,
    EMR: 100,
    GLUE: 30,
  },
  resource: {
    ...configProdEu2.resource,
    CLOUDWATCH_LOGS_INGESTION: {
      ENABLED: false,
    },
    CLOUDWATCH_LOGS_S3_EXPORT: {
      ENABLED: false,
    },
  },
  viper: {
    ADMIN_EMAILS: ADMIN_EMAILS,
    CREATE_METASTORE: true,
    CREATE_VPC: false,
  },
  application: {
    MONGO_ATLAS_PROJECT: 'Tarpon-Production',
    MONGO_ATLAS_CLUSTER: 'Prod-BOM',
    AUTH0_DOMAIN: 'flagright.eu.auth0.com',
    AUTH0_AUDIENCE: 'https://api.flagright.com/',
    MAXIMUM_ALLOWED_EXPORT_SIZE: 10000,
    ZENDUTY_WEBHOOK_URL:
      'https://events.zenduty.com/integration/ro7ie/cloudwatch_v2/94d6c1fe-c451-47eb-982f-89b27001a1b1/',
    CONSOLE_URI: 'https://console.flagright.com',
    SLACK_CLIENT_ID: '2800969986821.3767916979623',
    SLACK_CLIENT_SECRET: 'c4263c5996fb4b219f4cf79e7bc05b1a',
    SLACK_REDIRECT_URI:
      'https://asia-2.api.flagright.com/console/slack/oauth_redirect',
    WEBHOOK_REQUEST_TIMEOUT_SEC: 10,
    GOOGLE_SHEETS_CLIENT_EMAIL: `google-sheets-api-usage-metric@linen-waters-385109.iam.gserviceaccount.com`,
    API_USAGE_GOOGLE_SHEET_ID: '1aR0OsWWHP_TDKHZoNvwmkxfCmApWPZDO_78EODig5Ps',
    POSTHOG_HOST: 'https://eu.i.posthog.com',
    POSTHOG_API_KEY: 'phc_TjqVLBQelI3KfF61sd8iHiA9ThVmjG1k2vJYVcPgCbO',
  },
  clickhouse: {
    awsPrivateLinkEndpointName:
      'com.amazonaws.vpce.ap-south-1.vpce-svc-0c230d09f9a784f0f',
    maxTotalMemoryGb: 96,
    numReplicas: 3,
  },
  opensearch: {
    deploy: true,
    dataNodes: 7,
    dataNodeInstanceType: 'm7g.2xlarge.search',
    volumeSize: 25,
  },
}
