import { KinesisStreamEvent } from 'aws-lambda'

export const tarponChangeCaptureHandler = async (event: KinesisStreamEvent) => {
  // Implementation pending
  console.log('Kinesis Event')
  console.log(event)
}
