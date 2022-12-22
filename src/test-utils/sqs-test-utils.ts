import { SQSRecord } from 'aws-lambda'

export function createSqsEvent(payloads: object[]) {
  return {
    Records: payloads.map(
      (payload) => ({ body: JSON.stringify(payload) } as SQSRecord)
    ),
  }
}
