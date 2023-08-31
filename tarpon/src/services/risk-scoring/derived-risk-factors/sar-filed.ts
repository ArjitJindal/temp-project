import { TransactionRiskFactorValueHandler } from '.'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ReportService } from '@/services/sar/service'

export const ARS_SAR_FILED_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<boolean>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'originUserSarFiled',
    handler: async (transaction, _users, _parameter, tenantId) => {
      const mongoDb = await getMongoDbClient()
      const reportsService = new ReportService(tenantId, mongoDb)
      if (!transaction.originUserId) {
        return [false]
      }
      const count = (
        await reportsService.reportsFiledForUser(transaction.originUserId, {
          _id: 1,
        })
      ).total
      return [count > 0]
    },
  },
  {
    entityType: 'TRANSACTION',
    parameter: 'destinationUserSarFiled',
    handler: async (transaction, _users, _parameter, tenantId) => {
      const mongoDb = await getMongoDbClient()
      const reportsService = new ReportService(tenantId, mongoDb)
      if (!transaction.destinationUserId) {
        return [false]
      }
      const count = (
        await reportsService.reportsFiledForUser(
          transaction.destinationUserId,
          { _id: 1 }
        )
      ).total
      return [count > 0]
    },
  },
]
