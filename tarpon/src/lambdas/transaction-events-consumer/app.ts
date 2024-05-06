import { SQSEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'

export const transactionEventsHandler = lambdaConsumer()(
  async (_event: SQSEvent) => {
    await Promise.all([
      //process all the events using transactionHandler
    ])
  }
)
