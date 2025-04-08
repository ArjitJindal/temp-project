import {
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { BadRequest } from 'http-errors'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SearchProfileRequest } from '@/@types/openapi-internal/SearchProfileRequest'
import { SearchProfileResponse } from '@/@types/openapi-internal/SearchProfileResponse'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getContext } from '@/core/utils/context-storage'

@traceable
export class SearchProfileRepository {
  private tenantId: string
  private tableName: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }

  public async markAllProfilesAsNonDefault(
    dynamoDb: DynamoDBClient,
    excludeProfileId?: string
  ): Promise<void> {
    const timestamp = Date.now()
    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :partitionKey',
      FilterExpression: excludeProfileId
        ? 'isDefault = :isDefault AND searchProfileId <> :currentId'
        : 'isDefault = :isDefault',
      ExpressionAttributeValues: {
        ':partitionKey': DynamoDbKeys.SEARCH_PROFILE(this.tenantId)
          .PartitionKeyID,
        ':isDefault': true,
        ...(excludeProfileId ? { ':currentId': excludeProfileId } : {}),
      },
    }

    const { Items: defaultProfiles } = await dynamoDb.send(
      new QueryCommand(queryInput)
    )

    if (defaultProfiles && defaultProfiles.length > 0) {
      for (const profile of defaultProfiles) {
        const key = DynamoDbKeys.SEARCH_PROFILE(
          this.tenantId,
          profile.searchProfileId
        )
        await dynamoDb.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: {
              PartitionKeyID: key.PartitionKeyID,
              SortKeyID: key.SortKeyID,
            },
            UpdateExpression:
              'SET isDefault = :isDefault, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':isDefault': false,
              ':updatedAt': timestamp,
            },
          })
        )
      }
    }
  }

  public async createSearchProfile(
    dynamoDb: DynamoDBClient,
    searchProfile: SearchProfileRequest,
    searchProfileId: string
  ): Promise<SearchProfileResponse> {
    const timestamp = Date.now()
    const key = DynamoDbKeys.SEARCH_PROFILE(this.tenantId, searchProfileId)
    const createdBy = getContext()?.user?.id
    const updatedBy = getContext()?.user?.id
    const item = {
      ...key,
      searchProfileId,
      ...searchProfile,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy,
      updatedBy,
    }

    await dynamoDb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      })
    )

    return this.mapDynamoItemToSearchProfile(item)
  }

  private mapDynamoItemToSearchProfile(item: any): SearchProfileResponse {
    // remove the PartitionKeyID and SortKeyID from the item
    delete item.PartitionKeyID
    delete item.SortKeyID

    return item as SearchProfileResponse
  }

  public async updateSearchProfile(
    dynamoDb: DynamoDBClient,
    existingSearchProfile: SearchProfileResponse,
    searchProfile: SearchProfileRequest
  ): Promise<SearchProfileResponse> {
    const key = {
      PartitionKeyID: DynamoDbKeys.SEARCH_PROFILE(
        this.tenantId,
        existingSearchProfile.searchProfileId
      ).PartitionKeyID,
      SortKeyID: existingSearchProfile.searchProfileId,
    }

    const timestamp = Date.now()
    const updatedProfile = {
      ...existingSearchProfile,
      ...searchProfile,
      updatedAt: timestamp,
    }

    // Build update expression dynamically based on provided fields
    const updateExpressions: string[] = []
    const expressionAttributeValues: Record<string, any> = {}

    if (updatedProfile.searchProfileName !== undefined) {
      updateExpressions.push('searchProfileName = :name')
      expressionAttributeValues[':name'] = updatedProfile.searchProfileName
    }

    if (updatedProfile.searchProfileDescription !== undefined) {
      updateExpressions.push('searchProfileDescription = :description')
      expressionAttributeValues[':description'] =
        updatedProfile.searchProfileDescription
    }

    if (updatedProfile.isDefault !== undefined) {
      updateExpressions.push('isDefault = :isDefault')
      expressionAttributeValues[':isDefault'] = updatedProfile.isDefault
    }

    if (updatedProfile.fuzziness !== undefined) {
      updateExpressions.push('fuzziness = :fuzziness')
      expressionAttributeValues[':fuzziness'] = updatedProfile.fuzziness
    }

    if (updatedProfile.types !== undefined) {
      updateExpressions.push('types = :types')
      expressionAttributeValues[':types'] = updatedProfile.types
    }

    if (updatedProfile.nationality !== undefined) {
      updateExpressions.push('nationality = :nationality')
      expressionAttributeValues[':nationality'] = updatedProfile.nationality
    }

    if (updatedProfile.searchProfileStatus !== undefined) {
      updateExpressions.push('searchProfileStatus = :searchProfileStatus')
      expressionAttributeValues[':searchProfileStatus'] =
        updatedProfile.searchProfileStatus
    }

    // Always update these fields
    updateExpressions.push('updatedAt = :updatedAt')
    updateExpressions.push('updatedBy = :updatedBy')
    expressionAttributeValues[':updatedAt'] = timestamp
    expressionAttributeValues[':updatedBy'] = getContext()?.user?.id

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const result = await dynamoDb.send(command)
    return this.mapDynamoItemToSearchProfile(result.Attributes)
  }

  public async getSearchProfiles(
    dynamoDb: DynamoDBClient,
    filterSearchProfileIds?: string[],
    filterSearchProfileNames?: string[],
    filterSearchProfileStatus?: string
  ): Promise<{
    items: SearchProfileResponse[]
    total: number
  }> {
    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :partitionKey',
      ExpressionAttributeValues: {
        ':partitionKey': DynamoDbKeys.SEARCH_PROFILE(this.tenantId)
          .PartitionKeyID,
      },
    }

    const filterExpressions: string[] = []
    if (filterSearchProfileIds && filterSearchProfileIds.length > 0) {
      const idConditions = filterSearchProfileIds.map(
        (_, index) => `searchProfileId = :id${index}`
      )
      filterExpressions.push(`(${idConditions.join(' OR ')})`)

      filterSearchProfileIds.forEach((id, index) => {
        if (!queryInput.ExpressionAttributeValues) {
          queryInput.ExpressionAttributeValues = {}
        }
        queryInput.ExpressionAttributeValues[`:id${index}`] = id
      })
    }
    if (filterSearchProfileNames && filterSearchProfileNames.length > 0) {
      const nameConditions = filterSearchProfileNames.map(
        (_, index) => `searchProfileName = :name${index}`
      )
      filterExpressions.push(`(${nameConditions.join(' OR ')})`)

      filterSearchProfileNames.forEach((name, index) => {
        if (!queryInput.ExpressionAttributeValues) {
          queryInput.ExpressionAttributeValues = {}
        }
        queryInput.ExpressionAttributeValues[`:name${index}`] = name
      })
    }
    if (filterSearchProfileStatus) {
      filterExpressions.push(`searchProfileStatus = :searchProfileStatus`)
      if (!queryInput.ExpressionAttributeValues) {
        queryInput.ExpressionAttributeValues = {}
      }
      queryInput.ExpressionAttributeValues[`:searchProfileStatus`] =
        filterSearchProfileStatus
    }

    if (filterExpressions.length > 0) {
      queryInput.FilterExpression = filterExpressions.join(' AND ')
    }

    const { Items: allItems } = await dynamoDb.send(
      new QueryCommand(queryInput)
    )

    const items = (allItems || [])
      .map((item) => this.mapDynamoItemToSearchProfile(item))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    return {
      items,
      total: items.length,
    }
  }

  public async deleteSearchProfile(
    dynamoDb: DynamoDBClient,
    searchProfileId: string
  ): Promise<void> {
    const key = DynamoDbKeys.SEARCH_PROFILE(this.tenantId, searchProfileId)
    const { items: existingItems } = await this.getSearchProfiles(dynamoDb, [
      searchProfileId,
    ])
    if (!existingItems || existingItems.length === 0) {
      throw new BadRequest('Search profile not found')
    }

    await dynamoDb.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PartitionKeyID: key.PartitionKeyID,
          SortKeyID: key.SortKeyID,
        },
      })
    )
  }
}
