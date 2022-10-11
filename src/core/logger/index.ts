import { createLogger, format, transports } from 'winston'
import { getContext } from '../utils/context'

const isLocal = process.env.ENV
const logFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
)
export const winstonLogger = createLogger({
  level: isLocal ? 'debug' : 'info',
  format: isLocal ? format.combine(logFormat, format.prettyPrint()) : logFormat,
  transports: [new transports.Console({})],
})

export const logger = new Proxy(winstonLogger, {
  get(target, property, receiver) {
    target = target.child(getContext()?.logMetaData || {})
    return Reflect.get(target, property, receiver)
  },
})
