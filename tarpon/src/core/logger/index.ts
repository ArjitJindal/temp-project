import { LeveledLogMethod, createLogger, format, transports } from 'winston'
import * as Sentry from '@sentry/serverless'
import _ from 'lodash'
import { getContext } from '../utils/context'

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
  level: process.env.NODE_ENV === 'test' ? 'error' : isLocal ? 'debug' : 'info',
  format: isLocal ? localLogFormat : logFormat,
  transports: [new transports.Console({})],
})

winstonLogger.error = _.wrap(
  winstonLogger.error,
  (func: any, arg: any, ...rest) => {
    let error = arg
    if (!(arg instanceof Error)) {
      error = new Error(arg)
      error.name = arg
    }
    const extra = rest.find(_.isPlainObject)
    if (!isLocal) {
      Sentry.captureException(error, { extra })
    }
    return func(error, ...rest)
  }
) as LeveledLogMethod

export const logger = new Proxy(winstonLogger, {
  get(target, property, receiver) {
    target = target.child(getContext()?.logMetadata || {})
    return Reflect.get(target, property, receiver)
  },
})
