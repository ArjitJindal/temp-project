import { TransactionRiskFactorValueHandler } from '.'

export const ARS_SAR_FILED_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<boolean>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'originUserSarFiled',
    handler: async () => {
      return [Math.random() > 0.5]
    },
  },
  {
    entityType: 'TRANSACTION',
    parameter: 'destinationUserSarFiled',
    handler: async () => {
      return [Math.random() > 0.5]
    },
  },
]
