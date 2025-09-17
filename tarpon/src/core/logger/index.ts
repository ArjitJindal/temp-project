import { LeveledLogMethod, createLogger, format, transports } from 'winston'
import { withScope, captureException } from '@sentry/aws-serverless'
import {
  withScope as withScopeNode,
  captureException as captureExceptionNode,
} from '@sentry/node'
import isPlainObject from 'lodash/isPlainObject'
import wrap from 'lodash/wrap'
import { getContext } from '../utils/context-storage'
import { envIs } from '@/utils/env'

const isLocal = process.env.ENV === 'local'
const logFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
)
const localLogFormat = format.combine(
  format.colorize(),
  format.simple(),
  format.printf(({ level, message, ...rest }) => {
    const context = JSON.stringify(rest)
    return `${new Date().toISOString()} ${level}: ${message} ${context}`
  })
)

export const winstonLogger = createLogger({
  silent: envIs('test'),
  level: isLocal ? 'debug' : process.env.LOG_LEVEL || 'info',
  format: isLocal ? localLogFormat : logFormat,
  transports: [new transports.Console({})],
})

// removing once we have resolved throttling execption
const shouldSkipSentryLogging = (error: Error, extra: any): boolean => {
  const skipMessages = [
    'Throughput exceeds the current capacity of your table or index', //https://flagright-data-technologies-in.sentry.io/issues/6865563889/?project=6567808&query=is%3Aunresolved&referrer=issue-stream
    'The conditional request failed', //https://flagright-data-technologies-in.sentry.io/issues/6869317684/?project=6567808&query=is%3Aunresolved&referrer=issue-stream
    // Add more messages you want to skip
    'Processing transaction in fargate', //https://flagright-data-technologies-in.sentry.io/issues/6869617490/?project=6567808&query=is%3Aunresolved%20processing%20transaction&referrer=issue-stream
  ]
  const skipErrorTypes = [
    'ThrottlingException',
    'ConditionalCheckFailedException',
  ]

  if (skipMessages.some((msg) => error.message.includes(msg))) {
    return true
  }

  if (skipErrorTypes.includes(error.name)) {
    return true
  }

  // Skip by custom property
  if ((extra as any)?.skipSentry === true) {
    return true
  }

  return false
}

winstonLogger.error = wrap(
  winstonLogger.error,
  (func: any, arg: any, ...rest) => {
    let error = arg
    if (!(arg instanceof Error)) {
      error = new Error(arg)
      error.name = arg
    }
    const extra = rest.find(isPlainObject)

    if (!isLocal && !shouldSkipSentryLogging(error, extra)) {
      const sentryFunctions = [
        { withScope, captureException },
        { withScope: withScopeNode, captureException: captureExceptionNode },
      ]

      sentryFunctions.forEach(
        ({
          withScope: sentryWithScope,
          captureException: sentryCaptureException,
        }) => {
          sentryWithScope((scope) => {
            const context = getContext()
            if (context?.logMetadata) {
              scope.setTags(context.logMetadata)
            }
            if (context?.sentryExtras) {
              scope.setExtras(context.sentryExtras)
            }
            sentryCaptureException(error, { extra })
          })
        }
      )
    }
    return func(error.message, { ...extra, ...getContext()?.logMetadata })
  }
) as LeveledLogMethod

export const logger = new Proxy(winstonLogger, {
  get(target, property, receiver) {
    target = target.child(getContext()?.logMetadata || {})
    return Reflect.get(target, property, receiver)
  },
})
