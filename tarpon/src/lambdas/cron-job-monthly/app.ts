import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'

export const cronJobMonthlyHandler = lambdaConsumer()(async () => {
  // No op
})
