import { Filter } from 'mongodb'
import { WithOperators } from 'thunder-schema'
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
  public buildMongoFilters: (filters: BatchJobParams) => MongoFilters = (
    filters: BatchJobParams
  ) => {
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

    if (filters.parameters?.schema) {
      mongoFilters['parameters.schema'] = filters.parameters.schema
    }

    if (filters.parameters?.entityId) {
      mongoFilters['parameters.entityId'] = filters.parameters.entityId
    }

    return { mongoFilters }
  }

  public buildDynamoFilters: (filters: BatchJobParams) => DynamoFilters = (
    filters: BatchJobParams
  ) => {
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

  public buildClickhouseFilters: (
    filters: BatchJobParams
  ) => Partial<WithOperators<BatchJobInDb>> = (filters: BatchJobParams) => {
    const conditions: Partial<WithOperators<BatchJobInDb>> = {}
    if (filters.type) {
      conditions.type = filters.type
    }

    if (filters.latestStatus?.status) {
      conditions.latestStatus = {
        status: filters.latestStatus.status,
      }
    }

    if (filters.latestStatus?.latestStatusAfterTimestamp) {
      conditions.latestStatus = {
        timestamp__gt: filters.latestStatus.latestStatusAfterTimestamp,
      }
    }

    if (filters.latestStatus?.latestStatusBeforeTimestamp) {
      conditions.latestStatus = {
        timestamp__lt: filters.latestStatus.latestStatusBeforeTimestamp,
      }
    }

    if (filters.providers && filters.providers.length > 0) {
      conditions.parameters = {
        providers__has_any: filters.providers,
      }
    }

    if (filters.parameters?.entityType) {
      conditions.parameters = {
        entityType__has_any: filters.parameters.entityType,
      }
    }

    return conditions
  }
}
