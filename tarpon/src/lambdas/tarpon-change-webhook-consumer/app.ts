import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { diff } from 'deep-object-diff'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { StreamConsumerBuilder } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { UserStateDetails } from '@/@types/openapi-public/UserStateDetails'
import {
  sendWebhookTasks,
  ThinWebhookDeliveryTask,
} from '@/services/webhook/utils'

type GenericUser = Business | User

async function userHandler(
  tenantId: string,
  oldUser: GenericUser | undefined,
  newUser: GenericUser | undefined
) {
  const webhookTasks: ThinWebhookDeliveryTask[] = []
  const diffResult = diff(oldUser || {}, newUser || {}) as Partial<GenericUser>

  if (diffResult?.userStateDetails && newUser?.userStateDetails) {
    const payload: UserStateDetails = {
      userId: newUser.userId,
      ...newUser.userStateDetails,
    }
    webhookTasks.push({
      event: 'USER_STATE_UPDATED',
      payload,
    })
  }
  await sendWebhookTasks(tenantId, webhookTasks)
}

const builder = new StreamConsumerBuilder(
  path.basename(__dirname),
  process.env.WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL!
).setUserHandler((tenantId, oldUser, newUser) =>
  userHandler(tenantId, oldUser, newUser)
)

const kinesisHandler = builder.buildKinesisStreamHandler()
const sqsRetryHandler = builder.buildSqsRetryHandler()

export const tarponChangeWebhookHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    await kinesisHandler(event)
  }
)

export const tarponChangeWebhookRetryHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    await sqsRetryHandler(event)
  }
)
