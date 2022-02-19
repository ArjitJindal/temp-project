import { KinesisStreamEvent } from 'aws-lambda'

export const tarponChangeCaptureHandler = async (event: KinesisStreamEvent) => {
  console.log('Kinesis Event')
  console.log(event)
}
