import { KinesisStreamEvent } from 'aws-lambda'
import { diff } from 'deep-object-diff'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { v4 as uuidv4 } from 'uuid'
import { WebhookRepository } from './repositories/webhook-repository'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TarponStreamConsumerBuilder } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { WebhookDeliveryTask } from '@/@types/webhook'
import { connectToDB } from '@/utils/mongoDBUtils'
import { logger } from '@/core/logger'

const sqs = new SQSClient({})

type GenericUser = Business | User
type ThinWebhookDeliveryTask = Pick<WebhookDeliveryTask, 'event' | 'payload'>

async function sendWebhookTasks(
  tenantId: string,
  webhookTasks: ThinWebhookDeliveryTask[]
) {
  const createdAt = Date.now()
  const webhookRepository = new WebhookRepository(tenantId, await connectToDB())
  const webhooksByEvent = await webhookRepository.getWebhooksByEvents(
    webhookTasks.map((task) => task.event)
  )

  for (const webhookTask of webhookTasks) {
    for (const webhook of webhooksByEvent.get(webhookTask.event) || []) {
      const finalWebhookTask: WebhookDeliveryTask = {
        ...webhookTask,
        _id: uuidv4(),
        tenantId,
        webhookId: webhook._id as string,
        webhookUrl: webhook.webhookUrl,
        createdAt,
      }
      await sqs.send(
        new SendMessageCommand({
          MessageBody: JSON.stringify(finalWebhookTask),
          QueueUrl: process.env.WEBHOOK_DELIVERY_QUEUE_URL as string,
        })
      )
      logger.info(
        `Sent webhook delivery task for event ${finalWebhookTask.event}`
      )
    }
  }
}

async function userHandler(
  tenantId: string,
  oldUser: GenericUser,
  newUser: GenericUser
) {
  const webhookTasks: ThinWebhookDeliveryTask[] = []
  const diffResult = diff(oldUser, newUser) as Partial<GenericUser>

  if (diffResult.userStateDetails) {
    webhookTasks.push({
      event: 'USER_STATE_UPDATED',
      payload: diffResult.userStateDetails,
    })
  }
  await sendWebhookTasks(tenantId, webhookTasks)
}

const handler = new TarponStreamConsumerBuilder()
  .setUserHandler((tenantId, oldUser, newUser) =>
    userHandler(tenantId, oldUser, newUser)
  )
  .build()

export const tarponChangeCaptureHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    await handler(event)
  }
)
