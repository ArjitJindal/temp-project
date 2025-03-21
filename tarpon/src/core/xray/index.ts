import process from 'process'
import { Subsegment } from 'aws-xray-sdk-core'
import { StackConstants } from '@lib/constants'
import { logger } from '@/core/logger'
import { envIsNot } from '@/utils/env'

// NOTE: Allowed special chars: _, ., :, /, %, &, #, =, +, \, -, @
// ref: https://docs.aws.amazon.com/xray/latest/devguide/xray-api-segmentdocuments.html
const ALLOWED_SPECIAL_CHAR_REGEX = /[`,~!#$^*()|?;'"<>{}[\]/]/g

const xrayDisabled =
  envIsNot('dev', 'sandbox', 'prod') ||
  (!process.env.AWS_LAMBDA_FUNCTION_NAME?.includes('Api') &&
    process.env.AWS_LAMBDA_FUNCTION_NAME !==
      StackConstants.TARPON_QUEUE_CONSUMER_FUNCTION_NAME)

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

export function traceable(target: any) {
  // Get all property keys of the class prototype
  const propertyKeys = Object.getOwnPropertyNames(target.prototype)

  // Iterate over each property key
  propertyKeys.forEach((key) => {
    const originalMethod = target.prototype[key]

    // Check if the property is a method
    if (typeof originalMethod === 'function') {
      // Create a new function to replace the original method
      if (target.prototype[key].constructor.name !== 'AsyncFunction') {
        return
      }

      target.prototype[key] = async function (...args: any[]) {
        if (!target.segmentInProgress) {
          target.segmentInProgress = true
          const serviceName = target?.name || 'unknown'
          const segment = await addNewSubsegment(serviceName, key)
          const convertToMB = (value: number) =>
            `${Math.round((value / 1024 / 1024) * 100) / 100} MB`
          try {
            const used = process.memoryUsage()
            const data = {
              rss: convertToMB(used.rss),
              heapTotal: convertToMB(used.heapTotal),
              heapUsed: convertToMB(used.heapUsed),
              external: convertToMB(used.external),
            }
            segment?.addMetadata('memory_usage', data)
            return await originalMethod.apply(this, args)
          } catch (err: any) {
            segment?.addError(err)
            throw err
          } finally {
            segment?.close()
            target.segmentInProgress = false
          }
        }
        return await originalMethod.apply(this, args)
      }
    }
  })

  return target
}
