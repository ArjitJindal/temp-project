import { BadRequest } from 'http-errors'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { CounterRepository } from '../counter/repository'
import { ScreeningProfileRepository } from './repositories/screening-profile-repository'
import { ScreeningProfileRequest } from '@/@types/openapi-internal/ScreeningProfileRequest'
import { ScreeningProfileResponse } from '@/@types/openapi-internal/ScreeningProfileResponse'
import { traceable } from '@/core/xray'

@traceable
export class ScreeningProfileService {
  private screeningProfileRepository: ScreeningProfileRepository
  private counterRepository: CounterRepository

  constructor(tenantId: string, counterRepository: CounterRepository) {
    this.screeningProfileRepository = new ScreeningProfileRepository(tenantId)
    this.counterRepository = counterRepository
  }

  public async getScreeningProfileId(): Promise<string> {
    return (
      'SCP-' +
      (
        await this.counterRepository.getNextCounterAndUpdate('ScreeningProfile')
      ).toString()
    )
  }

  public async getExistingScreeningProfile(
    dynamoDb: DynamoDBClient,
    screeningProfileId: string
  ): Promise<ScreeningProfileResponse> {
    const screeningProfile =
      await this.screeningProfileRepository.getScreeningProfiles(dynamoDb, [
        screeningProfileId,
      ])
    if (!screeningProfile.items.length) {
      throw new BadRequest('Screening profile not found')
    }
    return screeningProfile.items[0]
  }

  public async createScreeningProfile(
    dynamoDb: DynamoDBClient,
    screeningProfile: ScreeningProfileRequest
  ): Promise<ScreeningProfileResponse> {
    const screeningProfileId = await this.getScreeningProfileId()
    return this.screeningProfileRepository.createScreeningProfile(
      dynamoDb,
      screeningProfile,
      screeningProfileId
    )
  }

  public async getScreeningProfiles(
    dynamoDb: DynamoDBClient,
    filterScreeningProfileId?: string[],
    filterScreeningProfileName?: string[],
    filterScreeningProfileStatus?: string
  ): Promise<{
    items: ScreeningProfileResponse[]
    total: number
  }> {
    return this.screeningProfileRepository.getScreeningProfiles(
      dynamoDb,
      filterScreeningProfileId,
      filterScreeningProfileName,
      filterScreeningProfileStatus
    )
  }

  public async updateScreeningProfile(
    dynamoDb: DynamoDBClient,
    screeningProfileId: string,
    screeningProfile: ScreeningProfileRequest
  ): Promise<ScreeningProfileResponse> {
    const existingScreeningProfile = await this.getExistingScreeningProfile(
      dynamoDb,
      screeningProfileId
    )

    return this.screeningProfileRepository.updateScreeningProfile(
      dynamoDb,
      existingScreeningProfile,
      screeningProfile
    )
  }

  public async deleteScreeningProfile(
    dynamoDb: DynamoDBClient,
    screeningProfileId: string
  ): Promise<void> {
    await this.getExistingScreeningProfile(dynamoDb, screeningProfileId)
    return this.screeningProfileRepository.deleteScreeningProfile(
      dynamoDb,
      screeningProfileId
    )
  }
}
