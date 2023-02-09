import { createLogger, format, transports } from 'winston'
import Sentry from 'winston-transport-sentry-node'
import { getContext } from '../utils/context'
import { SENTRY_DSN } from '@/core/constants'

const isLocal = process.env.ENV === 'local'
const logFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
)
export const winstonLogger = createLogger({
  level: process.env.NODE_ENV === 'test' ? 'error' : isLocal ? 'debug' : 'info',
  format: isLocal ? format.combine(logFormat, format.prettyPrint()) : logFormat,
  transports: [
    new transports.Console({}),
    new Sentry({
      sentry: {
        dsn: SENTRY_DSN,
      },
      level: 'error',
    }),
  ],
})

export const logger = new Proxy(winstonLogger, {
  get(target, property, receiver) {
    target = target.child(getContext()?.logMetadata || {})
    return Reflect.get(target, property, receiver)
  },
})
