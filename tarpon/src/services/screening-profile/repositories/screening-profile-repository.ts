import {
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { BadRequest } from 'http-errors'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { ScreeningProfileRequest } from '@/@types/openapi-internal/ScreeningProfileRequest'
import { ScreeningProfileResponse } from '@/@types/openapi-internal/ScreeningProfileResponse'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getContext } from '@/core/utils/context-storage'

@traceable
export class ScreeningProfileRepository {
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
        ? 'isDefault = :isDefault AND screeningProfileId <> :currentId'
        : 'isDefault = :isDefault',
      ExpressionAttributeValues: {
        ':partitionKey': DynamoDbKeys.SCREENING_PROFILE(this.tenantId)
          .PartitionKeyID,
        ':isDefault': true,
        ...(excludeProfileId && { ':currentId': excludeProfileId }),
      },
    }

    const { Items: defaultProfiles } = await dynamoDb.send(
      new QueryCommand(queryInput)
    )

    if (defaultProfiles && defaultProfiles.length > 0) {
      for (const profile of defaultProfiles) {
        const key = DynamoDbKeys.SCREENING_PROFILE(
          this.tenantId,
          profile.screeningProfileId
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

  public async createScreeningProfile(
    dynamoDb: DynamoDBClient,
    screeningProfile: ScreeningProfileRequest,
    screeningProfileId: string
  ): Promise<ScreeningProfileResponse> {
    const timestamp = Date.now()
    const key = DynamoDbKeys.SCREENING_PROFILE(
      this.tenantId,
      screeningProfileId
    )
    const createdBy = getContext()?.user?.id
    const updatedBy = createdBy
    const item = {
      ...key,
      screeningProfileId,
      ...screeningProfile,
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

    return this.mapDynamoItemToScreeningProfile(item)
  }

  private mapDynamoItemToScreeningProfile(item: any): ScreeningProfileResponse {
    // remove the PartitionKeyID and SortKeyID from the item
    delete item.PartitionKeyID
    delete item.SortKeyID

    return item as ScreeningProfileResponse
  }

  public async updateScreeningProfile(
    dynamoDb: DynamoDBClient,
    existingScreeningProfile: ScreeningProfileResponse,
    screeningProfile: ScreeningProfileRequest
  ): Promise<ScreeningProfileResponse> {
    const key = {
      PartitionKeyID: DynamoDbKeys.SCREENING_PROFILE(
        this.tenantId,
        existingScreeningProfile.screeningProfileId
      ).PartitionKeyID,
      SortKeyID: existingScreeningProfile.screeningProfileId,
    }

    const timestamp = Date.now()
    const updatedProfile = {
      ...existingScreeningProfile,
      ...screeningProfile,
      updatedAt: timestamp,
      updatedBy: getContext()?.user?.id,
    }

    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...key,
        ...updatedProfile,
      },
    })

    await dynamoDb.send(command)
    return this.mapDynamoItemToScreeningProfile(updatedProfile)
  }

  public async getScreeningProfiles(
    dynamoDb: DynamoDBClient,
    filterScreeningProfileIds?: string[],
    filterScreeningProfileNames?: string[],
    filterScreeningProfileStatus?: string
  ): Promise<{
    items: ScreeningProfileResponse[]
    total: number
  }> {
    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :partitionKey',
      ExpressionAttributeValues: {
        ':partitionKey': DynamoDbKeys.SCREENING_PROFILE(this.tenantId)
          .PartitionKeyID,
      },
    }

    const filterExpressions: string[] = []
    if (filterScreeningProfileIds && filterScreeningProfileIds.length > 0) {
      const idConditions = filterScreeningProfileIds.map(
        (_, index) => `screeningProfileId = :id${index}`
      )
      filterExpressions.push(`(${idConditions.join(' OR ')})`)

      filterScreeningProfileIds.forEach((id, index) => {
        if (!queryInput.ExpressionAttributeValues) {
          queryInput.ExpressionAttributeValues = {}
        }
        queryInput.ExpressionAttributeValues[`:id${index}`] = id
      })
    }
    if (filterScreeningProfileNames && filterScreeningProfileNames.length > 0) {
      const nameConditions = filterScreeningProfileNames.map(
        (_, index) => `screeningProfileName = :name${index}`
      )
      filterExpressions.push(`(${nameConditions.join(' OR ')})`)

      filterScreeningProfileNames.forEach((name, index) => {
        if (!queryInput.ExpressionAttributeValues) {
          queryInput.ExpressionAttributeValues = {}
        }
        queryInput.ExpressionAttributeValues[`:name${index}`] = name
      })
    }
    if (filterScreeningProfileStatus) {
      filterExpressions.push(`screeningProfileStatus = :screeningProfileStatus`)
      if (!queryInput.ExpressionAttributeValues) {
        queryInput.ExpressionAttributeValues = {}
      }
      queryInput.ExpressionAttributeValues[`:screeningProfileStatus`] =
        filterScreeningProfileStatus
    }

    if (filterExpressions.length > 0) {
      queryInput.FilterExpression = filterExpressions.join(' AND ')
    }

    const { Items: allItems } = await dynamoDb.send(
      new QueryCommand(queryInput)
    )

    const items = (allItems || [])
      .map((item) => this.mapDynamoItemToScreeningProfile(item))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    return {
      items,
      total: items.length,
    }
  }

  public async deleteScreeningProfile(
    dynamoDb: DynamoDBClient,
    screeningProfileId: string
  ): Promise<void> {
    const key = DynamoDbKeys.SCREENING_PROFILE(
      this.tenantId,
      screeningProfileId
    )
    const { items: existingItems } = await this.getScreeningProfiles(dynamoDb, [
      screeningProfileId,
    ])
    if (!existingItems || existingItems.length === 0) {
      throw new BadRequest('Screening profile not found')
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
