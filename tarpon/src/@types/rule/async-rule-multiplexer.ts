import {
  AsyncRuleRecordTransaction,
  AsyncRuleRecordTransactionEvent,
} from '../batch-import'

export type IdentifierProcessingDetail = {
  queuedRecordIdentifiers: Set<string>
  groupId: string
  updatedAt: number
}

export type BatchItemFailure = { itemIdentifier: string }

export type AsyncMessage = {
  messageId: string
  record: AsyncRuleRecordTransaction | AsyncRuleRecordTransactionEvent
}

export type IdentifierMap = { [key: string]: string[] }
export type AsyncMessageGroupDetails = {
  group: AsyncMessage[]
  identifiers: string[]
}
