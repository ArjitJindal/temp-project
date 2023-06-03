import { Subsegment } from 'aws-xray-sdk-core'
import { logger } from '@/core/logger'

// NOTE: Allowed special chars: _, ., :, /, %, &, #, =, +, \, -, @
// ref: https://docs.aws.amazon.com/xray/latest/devguide/xray-api-segmentdocuments.html
const ALLOWED_SPECIAL_CHAR_REGEX = /[`,~!#$^*()|?;'"<>{}[\]/]/g

const xrayDisabled = process.env.ENV === 'local' || !!process.env.MIGRATION_TYPE

let xrayInitialized = false

export async function addNewSubsegment(
  namespace: string,
  segmentName: string
): Promise<Subsegment | undefined> {
  if (xrayDisabled) {
    return
  }
  const AWSXRay = await import('aws-xray-sdk-core')

  if (!xrayInitialized) {
    AWSXRay.capturePromise()
    xrayInitialized = true
  }

  const name = `${namespace}: ${segmentName}`.replace(
    ALLOWED_SPECIAL_CHAR_REGEX,
    ' '
  )
  try {
    return AWSXRay.getSegment()?.addNewSubsegment(name)
  } catch (e) {
    logger.error(e)
  }
}
