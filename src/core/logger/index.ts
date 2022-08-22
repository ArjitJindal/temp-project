import { createLogger, format, transports } from 'winston'
import { getContext } from '../utils/context'

export const winstonLogger = createLogger({
  level: process.env.ENV === 'local' ? 'debug' : 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [new transports.Console({})],
})

export const logger = new Proxy(winstonLogger, {
  get(target, property, receiver) {
    target = getContext()?.logger || target
    return Reflect.get(target, property, receiver)
  },
})
