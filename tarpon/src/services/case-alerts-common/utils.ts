import { difference } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { getPaymentDetailsIdentifiersSubject } from '../logic-evaluator/variables/payment-details'
import { DynamoConsumerMessage } from '@/lambdas/dynamo-db-trigger-consumer'
import {
  TransactWriteOperation,
  transactWrite,
  sendMessageToDynamoDbConsumer,
} from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { CASE_STATUSS } from '@/@types/openapi-internal-custom/CaseStatus'
import { shouldUseReviewAssignments } from '@/utils/helpers'
import { ALERT_STATUSS } from '@/@types/openapi-internal-custom/AlertStatus'
export type dynamoKey = {
  PartitionKeyID: string
  SortKeyID?: string
}

export type dynamoKeyList = {
  key: dynamoKey
}[]

export type dynamoKeyListOptions = {
  keyLists: dynamoKeyList
  tableName: string
}

export type CaseSubject =
  | { type: 'USER'; user: InternalUser }
  | { type: 'PAYMENT'; paymentDetails: PaymentDetails }

async function truncateDynamoConsumerMessageItems(
  dynamoDbConsumerMessage: DynamoConsumerMessage[] = []
) {
  const MAX_SIZE_KB = 250 // Keeping it 250KB instead of 256KB for some buffer
  const toReturnDynamoDbConsumerMessage: DynamoConsumerMessage[] = []

  for (const message of dynamoDbConsumerMessage) {
    const items = message.items
    const messageSize = Buffer.from(JSON.stringify(message)).length / 1024

    if (messageSize <= MAX_SIZE_KB) {
      toReturnDynamoDbConsumerMessage.push(message)
      continue
    }

    // Calculate how many full messages we need
    const ratio = messageSize / MAX_SIZE_KB
    const fullMessagesCount = Math.floor(ratio)
    const itemsPerMessage = Math.floor(items.length / ratio)

    // Create full messages
    for (let i = 0; i < fullMessagesCount; i++) {
      const startIndex = i * itemsPerMessage
      const endIndex = startIndex + itemsPerMessage
      toReturnDynamoDbConsumerMessage.push({
        ...message,
        items: items.slice(startIndex, endIndex),
      })
    }

    // Handle remaining items
    const remainingItems = items.slice(fullMessagesCount * itemsPerMessage)
    if (remainingItems.length > 0) {
      toReturnDynamoDbConsumerMessage.push({
        ...message,
        items: remainingItems,
      })
    }
  }

  return toReturnDynamoDbConsumerMessage
}

export async function transactWriteWithClickhouse(
  dynamoDb: DynamoDBDocumentClient,
  operations: TransactWriteOperation[],
  dynamoDbConsumerMessage: DynamoConsumerMessage[] = []
): Promise<void> {
  await transactWrite(dynamoDb, operations)
  const truncatedDynamoDbConsumerMessage =
    await truncateDynamoConsumerMessageItems(dynamoDbConsumerMessage)
  for (const message of truncatedDynamoDbConsumerMessage) {
    await sendMessageToDynamoDbConsumer(message)
  }
}

/**
 * Extract subject identifiers from a case based on its subjectType
 *
 * @param caseItem - The case object to extract subject identifiers from
 * @returns An array of subject identifiers
 */
export function extractCaseSubjectIdentifiers(caseItem: Case): string[] {
  const identifiers: string[] = []

  switch (caseItem.subjectType) {
    case 'USER':
      if (caseItem.caseUsers) {
        if (caseItem.caseUsers.origin?.userId) {
          identifiers.push(`user:${caseItem.caseUsers.origin.userId}`)
        }

        if (caseItem.caseUsers.destination?.userId) {
          identifiers.push(`user:${caseItem.caseUsers.destination.userId}`)
        }
      }
      break

    case 'PAYMENT':
      if (caseItem.paymentDetails) {
        if (caseItem.paymentDetails.origin) {
          const identifierString = getPaymentDetailsIdentifiersSubject(
            caseItem.paymentDetails.origin
          )
          if (identifierString) {
            identifiers.push(`payment:${identifierString}`)
          }
        }

        if (caseItem.paymentDetails.destination) {
          const identifierString = getPaymentDetailsIdentifiersSubject(
            caseItem.paymentDetails.destination
          )
          if (identifierString) {
            identifiers.push(`payment:${identifierString}`)
          }
        }
      }
      break

    default:
      if (caseItem.caseUsers) {
        if (caseItem.caseUsers.origin?.userId) {
          identifiers.push(`user:${caseItem.caseUsers.origin.userId}`)
        }

        if (caseItem.caseUsers.destination?.userId) {
          identifiers.push(`user:${caseItem.caseUsers.destination.userId}`)
        }
      }

      if (caseItem.paymentDetails) {
        if (caseItem.paymentDetails.origin) {
          const identifierString = getPaymentDetailsIdentifiersSubject(
            caseItem.paymentDetails.origin
          )
          if (identifierString) {
            identifiers.push(`payment:${identifierString}`)
          }
        }

        if (caseItem.paymentDetails.destination) {
          const identifierString = getPaymentDetailsIdentifiersSubject(
            caseItem.paymentDetails.destination
          )
          if (identifierString) {
            identifiers.push(`payment:${identifierString}`)
          }
        }
      }
      break
  }

  return identifiers
}

/**
 * Generates auxiliary indexes for a case to support efficient querying by subject
 * Uses checksums of identifiers for better data distribution in DynamoDB
 *
 * WARNING: ANY KIND OF CONDITIONAL LOGIC HERE WILL NOT GET THE UPDATED INDEXES
 * HENCE AVOID ADDING ANY CONDITIONAL LOGIC HERE
 *
 * @param caseItem - The case object to generate indexes for
 * @returns Array of objects containing partition and sort keys for the case
 */
export function getCaseAuxiliaryIndexes(
  tenantId: string,
  caseItem: Case
): {
  auxiliaryIndexes: Array<any>
  identifiers: string[]
} {
  const caseId = caseItem.caseId as string
  const indexes: { PartitionKeyID: string; SortKeyID: string }[] = []

  const identifiers = extractCaseSubjectIdentifiers(caseItem)

  for (const identifier of identifiers) {
    indexes.push({
      ...DynamoDbKeys.CASE_SUBJECT(tenantId, identifier, caseId),
    })
  }

  return { auxiliaryIndexes: indexes, identifiers }
}

export async function createUpdateCaseQueries(
  tenantId: string,
  tableName: string,
  updateItemDetails: {
    caseId: string
    UpdateExpression: string
    ExpressionAttributeValues: Record<string, any>
    caseItem?: Case
    identifiers?: string[]
  }
) {
  const {
    caseId,
    UpdateExpression,
    ExpressionAttributeValues,
    caseItem,
    identifiers,
  } = updateItemDetails
  const operations: TransactWriteOperation[] = []
  const keyLists: dynamoKeyList = []

  const mainKey = DynamoDbKeys.CASE(tenantId, caseId)
  operations.push({
    Update: {
      TableName: tableName,
      Key: mainKey,
      UpdateExpression,
      ExpressionAttributeValues,
    },
  })

  keyLists.push({
    key: mainKey,
  })

  // Get auxiliary indexes and add them to operations
  let auxiliaryIndexesOthers: {
    PartitionKeyID: string
    SortKeyID: string
  }[] = []
  if (caseItem?.caseSubjectIdentifiers || identifiers) {
    const identifiersToUse =
      identifiers ?? caseItem?.caseSubjectIdentifiers ?? []
    auxiliaryIndexesOthers = identifiersToUse.map((identifier) => {
      return DynamoDbKeys.CASE_SUBJECT(tenantId, identifier, caseId)
    })
  } else {
    if (!caseItem) {
      throw new Error(`Case with ID ${caseId} not found`)
    }
    const { auxiliaryIndexes } = getCaseAuxiliaryIndexes(tenantId, caseItem)
    auxiliaryIndexesOthers = auxiliaryIndexes
  }

  for (const index of auxiliaryIndexesOthers) {
    operations.push({
      Update: {
        TableName: tableName,
        Key: {
          PartitionKeyID: index.PartitionKeyID,
          SortKeyID: index.SortKeyID,
        },
        UpdateExpression,
        ExpressionAttributeValues,
      },
    })
  }

  return { operations, keyLists }
}

export function generateDynamoConsumerMessage(
  tenantId: string,
  keyListOptions: dynamoKeyListOptions[]
): DynamoConsumerMessage[] {
  const dynamoDbConsumerMessage: DynamoConsumerMessage[] = []
  for (const keyListOption of keyListOptions) {
    if (keyListOption.keyLists && keyListOption.keyLists.length > 0) {
      dynamoDbConsumerMessage.push({
        tenantId: tenantId,
        tableName: keyListOption.tableName,
        items: keyListOption.keyLists,
      })
    }
  }
  return dynamoDbConsumerMessage
}

export const getAssignmentsStatus = (
  key: 'reviewAssignments' | 'assignments',
  type: 'case' | 'alert'
): CaseStatus[] | AlertStatus[] => {
  const statuses = type === 'case' ? CASE_STATUSS : ALERT_STATUSS
  const reviewAssignmentsStatus = statuses.filter(shouldUseReviewAssignments)
  const assignmentsStatus = difference(statuses, reviewAssignmentsStatus)

  return key === 'assignments' ? assignmentsStatus : reviewAssignmentsStatus
}
