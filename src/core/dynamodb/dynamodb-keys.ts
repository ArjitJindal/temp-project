/**
 * DynamoDB Keys (partition key + sort key) Definitions:
 * We consolidate the DynamoDB keys in this file to be more maintainbable and reviewable.
 * The index key design will be a critical part of our system as it'll severely impact
 * the query performance and our AWS cost.
 */

export const DynamoDbKeys = {
  // Attributes: refer to Transaction
  TRANSACTION: (tenantId: string, transactionId: string) => ({
    PartitionKeyID: `${tenantId}#transaction#${transactionId}`,
    SortKeyID: transactionId,
  }),
  // Attributes: [transactionId]
  USER_TRANSACTION: (tenantId: string, userId: string, timestamp?: number) => ({
    PartitionKeyID: `${tenantId}#transaction#user:${userId}`,
    SortKeyID: `${timestamp}`,
  }),
  // Attributes: refer to RuleInstance
  RULE_INSTANCE: (tenantId: string, ruleInstanceId?: string) => ({
    PartitionKeyID: `${tenantId}#rule-instance`,
    SortKeyID: ruleInstanceId,
  }),
  // Attributes: refer to UserAggregationAttributes
  USER_AGGREGATION: (tenantId: string, userId: string) => ({
    PartitionKeyID: `${tenantId}#aggregation#user:${userId}`,
    SortKeyID: userId,
  }),
  // Attributes: refer to User / Business
  USER: (tenantId: string, userId: string) => ({
    PartitionKeyID: `${tenantId}#user#${userId}`,
    SortKeyID: userId,
  }),
  LIST: (tenantId: string, listName: string, indexName: string) => ({
    PartitionKeyID: `${tenantId}#list:${listName}`,
    SortKeyID: indexName,
  }),
}
