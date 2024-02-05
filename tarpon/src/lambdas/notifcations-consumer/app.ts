import { SQSEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'

export const notificationsConsumerHandler = lambdaConsumer()(
  async (_event: SQSEvent) => {}
)
