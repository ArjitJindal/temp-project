import * as Sentry from '@sentry/serverless'
import { Subsegment } from 'aws-xray-sdk-core'

// NOTE: Allowed special chars: _, ., :, /, %, &, #, =, +, \, -, @
// ref: https://docs.aws.amazon.com/xray/latest/devguide/xray-api-segmentdocuments.html
const ALLOWED_SPECIAL_CHAR_REGEX = /[`,~!#$^*()|?;'"<>{}[\]/]/g

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
  const name = `${namespace}: ${segmentName}`.replace(
    ALLOWED_SPECIAL_CHAR_REGEX,
    ' '
  )
  try {
    return AWSXRay.getSegment()?.addNewSubsegment(name)
  } catch (e) {
    Sentry.captureException(e)
  }
}
