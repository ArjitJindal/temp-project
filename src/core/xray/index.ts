import * as Sentry from '@sentry/serverless'
import { Subsegment } from 'aws-xray-sdk-core'

const xrayDisabled = process.env.ENV === 'local' || !!process.env.MIGRATION_TYPE

export async function initTracing() {
  if (xrayDisabled) {
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
  if (xrayDisabled) {
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
