import { Filter } from 'mongodb'
import { BatchJobParams, BatchJobInDb } from '@/@types/batch-job'

export interface MongoFilters {
  mongoFilters: Filter<BatchJobInDb>
}

export interface DynamoFilters {
  filterExpressions: string[]
  expressionAttributeValues: Record<string, any>
  expressionAttributeNames: Record<string, string>
}

export class BatchJobFilterUtils {
  static buildMongoFilters(filters: BatchJobParams): MongoFilters {
    const mongoFilters: Filter<BatchJobInDb> = {}

    if (filters.type) {
      mongoFilters.type = filters.type
    }

    if (filters.latestStatus?.status) {
      mongoFilters['latestStatus.status'] = filters.latestStatus.status
    }

    if (filters.latestStatus?.latestStatusAfterTimestamp) {
      mongoFilters['latestStatus.timestamp'] = {
        $gt: filters.latestStatus.latestStatusAfterTimestamp,
      }
    }

    if (filters.latestStatus?.latestStatusBeforeTimestamp) {
      mongoFilters['latestStatus.timestamp'] = {
        $lt: filters.latestStatus.latestStatusBeforeTimestamp,
      }
    }

    if (filters.providers) {
      mongoFilters.parameters = {
        $elemMatch: {
          provider: { $in: filters.providers },
        },
      }
    }

    if (filters.parameters?.entityType) {
      mongoFilters.parameters = {
        $elemMatch: {
          entityType: filters.parameters.entityType,
        },
      }
    }

    if (filters.parameters?.type) {
      mongoFilters.parameters = {
        $elemMatch: {
          provider: filters.parameters.type,
        },
      }
    }
    if (filters.parameters?.schema) {
      mongoFilters['parameters.schema'] = filters.parameters.schema
    }

    if (filters.parameters?.entityId) {
      mongoFilters['parameters.entityId'] = filters.parameters.entityId
    }

    if (filters.jobId) {
      if (filters.jobId.notEqualTo) {
        mongoFilters.jobId = {
          $ne: filters.jobId.notEqualTo,
        }
      }
      if (filters.jobId.equalTo) {
        mongoFilters.jobId = filters.jobId.equalTo
      }
    }

    return { mongoFilters }
  }

  static buildDynamoFilters(filters: BatchJobParams): DynamoFilters {
    const filterExpressions: string[] = []
    const expressionAttributeValues: Record<string, any> = {}
    const expressionAttributeNames: Record<string, string> = {}

    if (filters.type) {
      filterExpressions.push('#type = :type')
      expressionAttributeValues[':type'] = filters.type
      expressionAttributeNames['#type'] = 'type'
    }

    if (filters.latestStatus?.status) {
      filterExpressions.push('latestStatus.#status = :status')
      expressionAttributeValues[':status'] = filters.latestStatus.status
      expressionAttributeNames['#status'] = 'status'
    }

    if (filters.latestStatus?.latestStatusAfterTimestamp) {
      filterExpressions.push('latestStatus.#timestamp > :afterTimestamp')
      expressionAttributeValues[':afterTimestamp'] =
        filters.latestStatus.latestStatusAfterTimestamp
      expressionAttributeNames['#timestamp'] = 'timestamp'
    }

    if (filters.latestStatus?.latestStatusBeforeTimestamp) {
      filterExpressions.push('latestStatus.#timestamp < :beforeTimestamp')
      expressionAttributeValues[':beforeTimestamp'] =
        filters.latestStatus.latestStatusBeforeTimestamp
      expressionAttributeNames['#timestamp'] = 'timestamp'
    }

    if (filters.providers && filters.providers.length > 0) {
      filterExpressions.push('contains(providers, :provider)')
      expressionAttributeValues[':provider'] = filters.providers[0]
    }

    if (filters.parameters?.entityType) {
      filterExpressions.push('#parameters.#entityType = :entityType')
      expressionAttributeValues[':entityType'] = filters.parameters.entityType
      expressionAttributeNames['#parameters'] = 'parameters'
      expressionAttributeNames['#entityType'] = 'entityType'
    }

    if (filters.parameters?.schema) {
      filterExpressions.push('#parameters.#schema = :schema')
      expressionAttributeValues[':schema'] = filters.parameters.schema
      expressionAttributeNames['#parameters'] = 'parameters'
      expressionAttributeNames['#schema'] = 'schema'
    }

    if (filters.parameters?.entityId) {
      filterExpressions.push('#parameters.#entityId = :entityId')
      expressionAttributeValues[':entityId'] = filters.parameters.entityId
      expressionAttributeNames['#parameters'] = 'parameters'
      expressionAttributeNames['#entityId'] = 'entityId'
    }

    return {
      filterExpressions,
      expressionAttributeValues,
      expressionAttributeNames,
    }
  }
}
