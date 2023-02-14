import { createLogger, format, transports } from 'winston'
import * as Sentry from '@sentry/serverless'
import TransportStream from 'winston-transport'
import { getContext } from '../utils/context'

const isLocal = process.env.ENV === 'local'
const logFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
)

class SentryTransport extends TransportStream {
  public log(info: any) {
    const { tags } = info
    if (info['level'] == 'error') {
      Sentry.captureException(
        Object.values(info).find((value) => value instanceof Error),
        { tags }
      )
    }
  }
}

export const winstonLogger = createLogger({
  level: process.env.NODE_ENV === 'test' ? 'error' : isLocal ? 'debug' : 'info',
  format: isLocal ? format.combine(logFormat, format.prettyPrint()) : logFormat,
  transports: [
    new transports.Console({}),
    new SentryTransport({
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
