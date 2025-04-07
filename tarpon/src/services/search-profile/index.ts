import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BadRequest } from 'http-errors'
import { CounterRepository } from '../counter/repository'
import { SearchProfileRepository } from './repositories/search-profile-repository'
import { SearchProfileRequest } from '@/@types/openapi-internal/SearchProfileRequest'
import { SearchProfileResponse } from '@/@types/openapi-internal/SearchProfileResponse'
import { traceable } from '@/core/xray'

@traceable
export class SearchProfileService {
  private searchProfileRepository: SearchProfileRepository
  private counterRepository: CounterRepository
  constructor(tenantId: string, counterRepository: CounterRepository) {
    this.searchProfileRepository = new SearchProfileRepository(tenantId)
    this.counterRepository = counterRepository
  }

  public async getSearchProfileId(): Promise<string> {
    return (
      'SP-' +
      (
        await this.counterRepository.getNextCounterAndUpdate('SearchProfile')
      ).toString()
    )
  }

  public async getExistingSearchProfile(
    dynamoDb: DynamoDBClient,
    searchProfileId: string
  ): Promise<SearchProfileResponse> {
    const searchProfile = await this.searchProfileRepository.getSearchProfiles(
      dynamoDb,
      [searchProfileId]
    )
    if (!searchProfile.items.length) {
      throw new BadRequest('Search profile not found')
    }
    return searchProfile.items[0]
  }

  public async createSearchProfile(
    dynamoDb: DynamoDBClient,
    searchProfile: SearchProfileRequest
  ): Promise<SearchProfileResponse> {
    if (searchProfile.isDefault) {
      await this.searchProfileRepository.markAllProfilesAsNonDefault(dynamoDb)
    }
    const searchProfileId = await this.getSearchProfileId()
    return this.searchProfileRepository.createSearchProfile(
      dynamoDb,
      searchProfile,
      searchProfileId
    )
  }

  public async getSearchProfiles(
    dynamoDb: DynamoDBClient,
    filterSearchProfileId?: string[],
    filterSearchProfileName?: string[],
    filterSearchProfileStatus?: string
  ): Promise<{
    items: SearchProfileResponse[]
    total: number
  }> {
    return this.searchProfileRepository.getSearchProfiles(
      dynamoDb,
      filterSearchProfileId,
      filterSearchProfileName,
      filterSearchProfileStatus
    )
  }

  public async updateSearchProfile(
    dynamoDb: DynamoDBClient,
    searchProfileId: string,
    searchProfile: SearchProfileRequest
  ): Promise<SearchProfileResponse> {
    const existingSearchProfile = await this.getExistingSearchProfile(
      dynamoDb,
      searchProfileId
    )

    if (searchProfile.isDefault) {
      await this.searchProfileRepository.markAllProfilesAsNonDefault(
        dynamoDb,
        searchProfileId
      )
    }

    return this.searchProfileRepository.updateSearchProfile(
      dynamoDb,
      existingSearchProfile,
      searchProfile
    )
  }

  public async deleteSearchProfile(
    dynamoDb: DynamoDBClient,
    searchProfileId: string
  ): Promise<void> {
    await this.getExistingSearchProfile(dynamoDb, searchProfileId)
    return this.searchProfileRepository.deleteSearchProfile(
      dynamoDb,
      searchProfileId
    )
  }
}
