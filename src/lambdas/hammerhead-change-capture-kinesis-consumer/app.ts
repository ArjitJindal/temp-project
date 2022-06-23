import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'

export const hammerheadChangeCaptureHandler = async (
  event: KinesisStreamEvent
) => {
  try {
    for (const record of event.Records) {
      const payload: KinesisStreamRecordPayload = record.kinesis
      const message: string = Buffer.from(payload.data, 'base64').toString()
      const dynamoDBStreamObject = JSON.parse(message).dynamodb
      const tenantId = dynamoDBStreamObject.Keys.PartitionKeyID.S.split('#')[0]
      // STUB for now, until we start calculating ARS And DRS
      console.log(`From tenant with ID: ${tenantId}`)
    }
  } catch (err) {
    console.error(err)
    return 'Internal error'
  }
}
