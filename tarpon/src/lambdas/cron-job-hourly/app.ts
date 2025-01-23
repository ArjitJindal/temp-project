import { logger } from '@/core/logger'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'

export const cronJobHourlyHandler = lambdaConsumer()(async () => {
  // TODO: Will be used for hourly cron job
  logger.info('Running hourly cron job')
})
