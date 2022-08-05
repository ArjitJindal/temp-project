import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'

export const hammerheadChangeCaptureHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    try {
      for (const record of event.Records) {
        const payload: KinesisStreamRecordPayload = record.kinesis
        const message: string = Buffer.from(payload.data, 'base64').toString()
        const dynamoDBStreamObject = JSON.parse(message).dynamodb
        const tenantId =
          dynamoDBStreamObject.Keys.PartitionKeyID.S.split('#')[0]
        // STUB for now, until we start calculating ARS And DRS
        logger.info(`From tenant with ID: ${tenantId}`)
      }
    } catch (err) {
      logger.error(err)
      return 'Internal error'
    }
  }
)
