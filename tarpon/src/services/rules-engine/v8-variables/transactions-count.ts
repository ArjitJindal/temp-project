import { AggregationRepository } from '../repositories/aggregation-repository'
import { CommonUserRuleVariable } from './types'

export const SENDING_TRANSACTIONS_COUNT: CommonUserRuleVariable<number> = {
  key: 'sendingTransactionsCount',
  entity: 'USER',
  uiDefinition: {
    label: 'Sending transactions count',
    type: 'number',
  },
  valueType: 'number',
  load: async (user, { dynamoDb, tenantId }) => {
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)

    const { sendingTransactionsCount } =
      await aggregationRepository.getUserTransactionsCount(user.userId)

    return sendingTransactionsCount
  },
}

export const RECEIVING_TRANSACTIONS_COUNT: CommonUserRuleVariable<number> = {
  key: 'receivingTransactionsCount',
  entity: 'USER',
  uiDefinition: {
    label: 'Receiving transactions count',
    type: 'number',
  },
  valueType: 'number',
  load: async (user, { dynamoDb, tenantId }) => {
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)

    const { receivingTransactionsCount } =
      await aggregationRepository.getUserTransactionsCount(user.userId)

    return receivingTransactionsCount
  },
}
