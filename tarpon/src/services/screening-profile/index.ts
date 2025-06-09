import { BadRequest } from 'http-errors'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { CounterRepository } from '../counter/repository'
import { SanctionsService } from '../sanctions'
import { ScreeningProfileRepository } from './repositories/screening-profile-repository'
import { ScreeningProfileRequest } from '@/@types/openapi-internal/ScreeningProfileRequest'
import { ScreeningProfileResponse } from '@/@types/openapi-internal/ScreeningProfileResponse'
import { traceable } from '@/core/xray'
import { SanctionsSourceRelevance } from '@/@types/openapi-internal/SanctionsSourceRelevance'
import { PEPSourceRelevance } from '@/@types/openapi-internal/PEPSourceRelevance'
import { RELSourceRelevance } from '@/@types/openapi-internal/RELSourceRelevance'
import { AdverseMediaSourceRelevance } from '@/@types/openapi-internal/AdverseMediaSourceRelevance'
import { AcurisSanctionsSearchType } from '@/@types/openapi-internal/AcurisSanctionsSearchType'

@traceable
export class ScreeningProfileService {
  private screeningProfileRepository: ScreeningProfileRepository
  private tenantId: string
  private sanctionsService: SanctionsService // done to prevent circular dependency

  constructor(tenantId: string, sanctionsService: SanctionsService) {
    this.screeningProfileRepository = new ScreeningProfileRepository(tenantId)
    this.tenantId = tenantId
    this.sanctionsService = sanctionsService
  }

  public async getScreeningProfileId(
    counterRepository: CounterRepository
  ): Promise<string> {
    return (
      'SCP-' +
      (
        await counterRepository.getNextCounterAndUpdate('ScreeningProfile')
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
    screeningProfile: ScreeningProfileRequest,
    counterRepository: CounterRepository
  ): Promise<ScreeningProfileResponse> {
    const screeningProfileId = await this.getScreeningProfileId(
      counterRepository
    )
    if (screeningProfile.isDefault) {
      await this.screeningProfileRepository.markAllProfilesAsNonDefault(
        dynamoDb
      )
    }
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

  public async updateScreeningProfilesOnSanctionsSettingsChange(
    acurisSanctionsSearchType: AcurisSanctionsSearchType[],
    dynamoDb: DynamoDBClient
  ) {
    const screeningProfiles = await this.getScreeningProfiles(dynamoDb)
    const batchUpdateList: ScreeningProfileResponse[] = []
    for (const profile of screeningProfiles.items) {
      if (!acurisSanctionsSearchType.includes('SANCTIONS')) {
        profile.sanctions = {
          sourceIds: [],
          relevance: [],
        }
      }
      if (!acurisSanctionsSearchType.includes('PEP')) {
        profile.pep = {
          sourceIds: [],
          relevance: [],
        }
      }
      if (!acurisSanctionsSearchType.includes('REGULATORY_ENFORCEMENT_LIST')) {
        profile.rel = {
          sourceIds: [],
          relevance: [],
        }
      }
      if (!acurisSanctionsSearchType.includes('ADVERSE_MEDIA')) {
        profile.adverseMedia = {
          relevance: [],
        }
      }
      batchUpdateList.push(profile)
    }
    if (batchUpdateList.length > 0) {
      await this.screeningProfileRepository.batchUpdateScreeningProfiles(
        dynamoDb,
        batchUpdateList
      )
    }
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
    if (existingScreeningProfile.isDefault && !screeningProfile.isDefault) {
      throw new BadRequest(
        'Cannot remove default status. Set another profile as default first.'
      )
    }

    if (screeningProfile.isDefault) {
      await this.screeningProfileRepository.markAllProfilesAsNonDefault(
        dynamoDb,
        screeningProfileId
      )
    }
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
    const existingScreeningProfile = await this.getExistingScreeningProfile(
      dynamoDb,
      screeningProfileId
    )
    if (existingScreeningProfile.isDefault) {
      throw new BadRequest('Default screening profile cannot be deleted')
    }
    return this.screeningProfileRepository.deleteScreeningProfile(
      dynamoDb,
      screeningProfileId
    )
  }

  private createSourceConfig(
    searchType: AcurisSanctionsSearchType[] | undefined,
    type: AcurisSanctionsSearchType,
    config: Record<string, any>
  ): Record<string, any> {
    return searchType === undefined || searchType.includes(type) ? config : {}
  }

  public async createDefaultScreeningProfile(
    dynamoDb: DynamoDBClient,
    counterRepository: CounterRepository,
    acurisSanctionsSearchType?: AcurisSanctionsSearchType[]
  ) {
    const sources = await this.sanctionsService.getSanctionsSources()

    const sanctionSourceIds = sources.items
      .filter((source) => source.sourceType === 'SANCTIONS')
      .map((source) => source.id)
      .filter((id): id is string => id !== undefined)
    const pepSourceIds = sources.items
      .filter((source) => source.sourceType === 'PEP')
      .map((source) => source.id)
      .filter((id): id is string => id !== undefined)
    const relSourceIds = sources.items
      .filter((source) => source.sourceType === 'REGULATORY_ENFORCEMENT_LIST')
      .map((source) => source.id)
      .filter((id): id is string => id !== undefined)

    const defaultScreeningProfile: ScreeningProfileRequest = {
      screeningProfileName: 'Default screening profile',
      screeningProfileDescription:
        'A screening profile consisting of all available source lists and relevance nodes',
      isDefault: true,
      screeningProfileStatus: 'ENABLED' as const,

      ...this.createSourceConfig(
        acurisSanctionsSearchType,
        'SANCTIONS' as AcurisSanctionsSearchType,
        {
          sanctions: {
            sourceIds: sanctionSourceIds,
            relevance: ['CURRENT', 'FORMER'] as SanctionsSourceRelevance[],
          },
        }
      ),

      ...this.createSourceConfig(
        acurisSanctionsSearchType,
        'PEP' as AcurisSanctionsSearchType,
        {
          pep: {
            sourceIds: pepSourceIds,
            relevance: ['POI', 'PEP'] as PEPSourceRelevance[],
          },
        }
      ),

      ...this.createSourceConfig(
        acurisSanctionsSearchType,
        'REGULATORY_ENFORCEMENT_LIST' as AcurisSanctionsSearchType,
        {
          rel: {
            sourceIds: relSourceIds,
            relevance: [
              'FINANCIAL_REGULATOR',
              'LAW_ENFORCEMENT',
            ] as RELSourceRelevance[],
          },
        }
      ),

      ...this.createSourceConfig(
        acurisSanctionsSearchType,
        'ADVERSE_MEDIA' as AcurisSanctionsSearchType,
        {
          adverseMedia: {
            relevance: [
              'TERRORISM',
              'ORGANISED_CRIME',
              'MODERN_SLAVERY',
              'FINANCIAL_CRIME_AND_FRAUD',
              'BRIBERY_AND_CORRUPTION',
              'CYBERCRIMES',
            ] as AdverseMediaSourceRelevance[],
          },
        }
      ),
    }

    await this.createScreeningProfile(
      dynamoDb,
      defaultScreeningProfile,
      counterRepository
    )
  }

  public async checkIfDefaultScreeningProfileExists(
    dynamoDb: DynamoDBClient
  ): Promise<boolean> {
    const screeningProfiles = await this.getScreeningProfiles(dynamoDb)
    return screeningProfiles.items.some((profile) => profile.isDefault)
  }
}
