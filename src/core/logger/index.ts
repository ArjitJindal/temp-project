import { createLogger, format, transports } from 'winston'

export const logger = createLogger({
  level: process.env.ENV === 'local' ? 'debug' : 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [new transports.Console({})],
})
