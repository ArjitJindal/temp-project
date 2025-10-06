import { envIs } from '../env'
import { sanitizeSqlName } from './sanitize'

export const getClickhouseDbName = (tenantId: string) => {
  return sanitizeSqlName(
    envIs('test') ? `tarpon_test_${tenantId}` : `tarpon_${tenantId}`
  )
}
