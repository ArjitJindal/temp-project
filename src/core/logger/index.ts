import { createLogger, format, transports } from 'winston'
import { getContext } from '../utils/context'

const isLocal = process.env.ENV === 'local'
const logFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
)
export const winstonLogger = createLogger({
  level: process.env.NODE_ENV === 'test' ? 'error' : isLocal ? 'debug' : 'info',
  format: isLocal ? format.combine(logFormat, format.prettyPrint()) : logFormat,
  transports: [new transports.Console({})],
})

export const logger = new Proxy(winstonLogger, {
  get(target, property, receiver) {
    target = target.child(getContext()?.logMetadata || {})
    return Reflect.get(target, property, receiver)
  },
})
