import * as Sentry from '@sentry/serverless'
import { Subsegment } from 'aws-xray-sdk-core'

export async function initTracing() {
  if (process.env.ENV === 'local') {
    return
  }
  const AWSXRay = await import('aws-xray-sdk-core')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AWSXRay.captureHTTPsGlobal(require('http'))
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AWSXRay.captureHTTPsGlobal(require('https'))
  AWSXRay.capturePromise()
}

export async function addNewSubsegment(
  namespace: string,
  segmentName: string
): Promise<Subsegment | undefined> {
  if (process.env.ENV === 'local') {
    return
  }
  const AWSXRay = await import('aws-xray-sdk-core')
  try {
    return AWSXRay.getSegment()?.addNewSubsegment(
      `${namespace}: ${segmentName}`
    )
  } catch (e) {
    Sentry.captureException(e)
  }
}
