import { v4 as uuid } from 'uuid'
import { getUserKeyId } from '../logic-evaluator/engine/utils'
import {
  AsyncRuleRecordTransaction,
  AsyncRuleRecordTransactionEvent,
} from '@/@types/batch-import'
import { LogicAggregationType } from '@/@types/openapi-internal/LogicAggregationType'
import { DSU } from '@/utils/dsu'
import {
  AsyncMessage,
  AsyncMessageGroupDetails,
  IdentifierMap,
} from '@/@types/rule/async-rule-multiplexer'

export function getPrimaryRecordIdentifier(
  record: AsyncRuleRecordTransaction | AsyncRuleRecordTransactionEvent
): string {
  switch (record.type) {
    case 'TRANSACTION':
      return record.transaction.transactionId
    case 'TRANSACTION_EVENT':
      return record.transactionEventId
    default:
      return ''
  }
}

export function getConnectors(
  asyncMessage: AsyncMessage,
  aggregationTypes: LogicAggregationType[]
) {
  const tx =
    asyncMessage.record.type === 'TRANSACTION'
      ? asyncMessage.record.transaction
      : asyncMessage.record.updatedTransaction
  const unionConnectors: (string | undefined | null)[] = []
  for (const type of aggregationTypes) {
    let originIdentifier, destinationIdentifier
    if (type === 'USER_TRANSACTIONS') {
      originIdentifier = asyncMessage.record.senderUser?.userId
      destinationIdentifier = asyncMessage.record.receiverUser?.userId
    } else {
      originIdentifier = getUserKeyId(tx, 'origin', type)
      destinationIdentifier = getUserKeyId(tx, 'destination', type)
    }
    unionConnectors.push(originIdentifier, destinationIdentifier)
  }

  const filteredConnectors = unionConnectors.filter(
    (val): val is string => val != null
  )
  return filteredConnectors
}

export function buildGroups(
  asyncMessages: AsyncMessage[],
  aggregationTypes: LogicAggregationType[]
): {
  groups: AsyncMessageGroupDetails[]
  identifierToRecordMap: { [key: string]: string[] }
} {
  const identifierToRecordMap: IdentifierMap = {}
  const transactionToIdentifierMap: IdentifierMap = {}
  const dsu = new DSU()
  // Step 1: Union all related identifiers
  for (const asyncMessage of asyncMessages) {
    const connectors = getConnectors(asyncMessage, aggregationTypes)
    const primaryIdentifier = getPrimaryRecordIdentifier(asyncMessage.record)
    transactionToIdentifierMap[primaryIdentifier] = connectors
    if (connectors.length === 0) {
      continue
    }
    connectors.forEach((conn) => {
      identifierToRecordMap[conn] = [
        ...(identifierToRecordMap[conn] ?? []),
        primaryIdentifier,
      ]
    })

    const [base, ...rest] = connectors
    for (const c of rest) {
      dsu.union(base, c)
    }
  }

  // Step 2: Group transactions by DSU root
  const groups = new Map<string, AsyncMessageGroupDetails>()

  for (const asyncMessage of asyncMessages) {
    const connectors =
      transactionToIdentifierMap[
        getPrimaryRecordIdentifier(asyncMessage.record)
      ]
    if (connectors.length === 0) {
      // to Handle without connection link transactions
      groups.set(uuid(), { group: [asyncMessage], identifiers: [] })
      continue
    }
    const rep = dsu.find(connectors[0])
    const currentGroup = groups.get(rep)
    if (!currentGroup) {
      groups.set(rep, { group: [asyncMessage], identifiers: [...connectors] })
    } else {
      currentGroup.group.push(asyncMessage)
      currentGroup.identifiers.push(...connectors)
    }
  }

  return { groups: Array.from(groups.values()), identifierToRecordMap }
}
