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
  const tarponQueueName: string = SQSQueues.TARPON_QUEUE_NAME.name
  const secondaryTarponQueueName: string =
    SQSQueues.SECONDARY_TARPON_QUEUE_NAME.name
  const auditLogQueueName: string = SQSQueues.AUDIT_LOG_QUEUE_NAME.name
  const notificationsQueueName: string = SQSQueues.NOTIFICATIONS_QUEUE_NAME.name
  const webhookDeliveryQueueName: string =
    SQSQueues.WEBHOOK_DELIVERY_QUEUE_NAME.name
  const batchAsyncRuleQueueName: string =
    SQSQueues.BATCH_ASYNC_RULE_QUEUE_NAME.name
  const mongoDbConsumerQueueName: string =
    SQSQueues.MONGO_DB_CONSUMER_QUEUE_NAME.name
  const mongoUpdateConsumerQueueName: string =
    SQSQueues.MONGO_UPDATE_CONSUMER_QUEUE_NAME.name
  const dynamoDbConsumerQueueName: string =
    SQSQueues.DYNAMO_DB_CONSUMER_QUEUE_NAME.name
  const userEventQueueName: string = SQSQueues.USER_EVENT_QUEUE_NAME.name
  const slackAlertQueueName: string = SQSQueues.SLACK_ALERT_QUEUE_NAME.name
  const requestLoggerQueueName: string =
    SQSQueues.REQUEST_LOGGER_QUEUE_NAME.name
  const actionProcessingQueueName: string =
    SQSQueues.ACTION_PROCESSING_QUEUE_NAME.name
  const transactionEventQueueName: string =
    SQSQueues.TRANSACTION_EVENT_QUEUE_NAME.name

  process.env.AUDITLOG_TOPIC_ARN = `arn:aws:sns:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT}:${auditLogTopicName}`
  process.env.SHARED_ASSETS_BUCKET = getNameForGlobalResource(
    StackConstants.S3_SHARED_ASSETS_PREFIX,
    getConfig()
  )
  process.env.DYNAMO_DB_CONSUMER_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${dynamoDbConsumerQueueName}`
  process.env.MONGO_UPDATE_CONSUMER_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${mongoUpdateConsumerQueueName}`
  process.env.DOCUMENT_BUCKET = getNameForGlobalResource(
    StackConstants.S3_DOCUMENT_BUCKET_PREFIX,
    getConfig()
  )

  process.env.TARPON_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${tarponQueueName}`
  process.env.NOTIFICATIONS_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${notificationsQueueName}`
  process.env.WEBHOOK_DELIVERY_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${webhookDeliveryQueueName}`
  process.env.BATCH_ASYNC_RULE_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${batchAsyncRuleQueueName}`
  process.env.MONGO_DB_CONSUMER_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${mongoDbConsumerQueueName}`
  process.env.USER_EVENT_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${userEventQueueName}`
  process.env.TRANSACTION_EVENT_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${transactionEventQueueName}`
  process.env.REQUEST_LOGGER_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${requestLoggerQueueName}`
  process.env.SLACK_ALERT_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${slackAlertQueueName}`
  process.env.DYNAMO_DB_CONSUMER_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${dynamoDbConsumerQueueName}`
  process.env.MONGO_UPDATE_CONSUMER_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${mongoUpdateConsumerQueueName}`
  process.env.BATCH_JOB_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${batchJobQueueName}`
  process.env.ASYNC_RULE_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${asyncRuleQueueName}`
  process.env.ACTION_PROCESSING_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${actionProcessingQueueName}`
  process.env.AUDIT_LOG_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${auditLogQueueName}`
  process.env.SECONDARY_TARPON_QUEUE_URL = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT}/${secondaryTarponQueueName}`
}
