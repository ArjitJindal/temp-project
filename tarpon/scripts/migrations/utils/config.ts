import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils/env'
import {
  getNameForGlobalResource,
  SQSQueues,
  StackConstants,
} from '@lib/constants'

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

export function initializeEnvVars() {
  const batchJobQueueName: string = SQSQueues.BATCH_JOB_QUEUE_NAME.name
  const asyncRuleQueueName: string = SQSQueues.ASYNC_RULE_QUEUE_NAME.name
  const auditLogTopicName: string = StackConstants.AUDIT_LOG_TOPIC_NAME
  const mongoUpdateConsumerQueueName: string =
    SQSQueues.MONGO_UPDATE_CONSUMER_QUEUE_NAME.name
  const mongoDbConsumerQueueName: string =
    SQSQueues.MONGO_DB_CONSUMER_QUEUE_NAME.name
  process.env.BATCH_JOB_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${batchJobQueueName}`
  process.env.AUDITLOG_TOPIC_ARN = `arn:aws:sns:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT}:${auditLogTopicName}`
  process.env.ASYNC_RULE_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${asyncRuleQueueName}`
  process.env.SHARED_ASSETS_BUCKET = getNameForGlobalResource(
    StackConstants.S3_SHARED_ASSETS_PREFIX,
    getConfig()
  )
  process.env.MONGO_DB_CONSUMER_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${mongoDbConsumerQueueName}`
  process.env.MONGO_UPDATE_CONSUMER_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${mongoUpdateConsumerQueueName}`
  process.env.DOCUMENT_BUCKET = getNameForGlobalResource(
    StackConstants.S3_DOCUMENT_BUCKET_PREFIX,
    getConfig()
  )
}
