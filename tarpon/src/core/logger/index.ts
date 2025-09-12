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

winstonLogger.error = wrap(
  winstonLogger.error,
  (func: any, arg: any, ...rest) => {
    let error = arg
    if (!(arg instanceof Error)) {
      error = new Error(arg)
      error.name = arg
    }
    const extra = rest.find(isPlainObject)
    if (!isLocal) {
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
