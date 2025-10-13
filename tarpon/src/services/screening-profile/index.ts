import { BadRequest } from 'http-errors'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { CounterRepository } from '../counter/repository'
import { MongoSanctionSourcesRepository } from '../sanctions/repositories/sanction-source-repository'
import { getSanctionsSourceDocumentsCollectionName } from '../sanctions/utils'
import { SanctionsDataProviders } from '../sanctions/types'
import { ScreeningProfileRepository } from './repositories/screening-profile-repository'
import { ScreeningProfileRequest } from '@/@types/openapi-internal/ScreeningProfileRequest'
import { ScreeningProfileResponse } from '@/@types/openapi-internal/ScreeningProfileResponse'
import { traceable } from '@/core/xray'
import { SanctionsSourceRelevance } from '@/@types/openapi-internal/SanctionsSourceRelevance'
import { PEPSourceRelevance } from '@/@types/openapi-internal/PEPSourceRelevance'
import { AcurisSanctionsSearchType } from '@/@types/openapi-internal/AcurisSanctionsSearchType'
import { ADVERSE_MEDIA_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/AdverseMediaSourceRelevance'
import { REL_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/RELSourceRelevance'

@traceable
export class ScreeningProfileService {
  private screeningProfileRepository: ScreeningProfileRepository
  private mongoDb: MongoClient
  private dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.screeningProfileRepository = new ScreeningProfileRepository(
      tenantId,
      connections.dynamoDb
    )
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
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
    screeningProfileId: string
  ): Promise<ScreeningProfileResponse> {
    const screeningProfile =
      await this.screeningProfileRepository.getScreeningProfileById(
        screeningProfileId
      )
    if (!screeningProfile) {
      throw new BadRequest('Screening profile not found')
    }
    return screeningProfile
  }

  public async createScreeningProfile(
    screeningProfile: ScreeningProfileRequest,
    counterRepository: CounterRepository
  ): Promise<ScreeningProfileResponse> {
    const screeningProfileId = await this.getScreeningProfileId(
      counterRepository
    )
    if (screeningProfile.isDefault) {
      await this.screeningProfileRepository.markAllProfilesAsNonDefault()
    }
    return this.screeningProfileRepository.createScreeningProfile(
      screeningProfile,
      screeningProfileId
    )
  }

  public async getScreeningProfiles(
    filterScreeningProfileId?: string[],
    filterScreeningProfileName?: string[],
    filterScreeningProfileStatus?: string
  ): Promise<{
    items: ScreeningProfileResponse[]
    total: number
  }> {
    return this.screeningProfileRepository.getScreeningProfiles(
      filterScreeningProfileId,
      filterScreeningProfileName,
      filterScreeningProfileStatus
    )
  }

  public async updateScreeningProfilesOnSanctionsSettingsChange(
    acurisSanctionsSearchType: AcurisSanctionsSearchType[]
  ) {
    const screeningProfiles = await this.getScreeningProfiles()
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
        batchUpdateList
      )
    }
  }

  public async updateScreeningProfile(
    screeningProfileId: string,
    screeningProfile: ScreeningProfileRequest
  ): Promise<ScreeningProfileResponse> {
    const existingScreeningProfile = await this.getExistingScreeningProfile(
      screeningProfileId
    )
    if (existingScreeningProfile.isDefault && !screeningProfile.isDefault) {
      throw new BadRequest(
        'Cannot remove default status. Set another profile as default first.'
      )
    }

    if (screeningProfile.isDefault) {
      await this.screeningProfileRepository.markAllProfilesAsNonDefault(
        screeningProfileId
      )
    }
    return this.screeningProfileRepository.updateScreeningProfile(
      this.dynamoDb,
      existingScreeningProfile,
      screeningProfile
    )
  }

  public async deleteScreeningProfile(
    screeningProfileId: string
  ): Promise<void> {
    const existingScreeningProfile = await this.getExistingScreeningProfile(
      screeningProfileId
    )
    if (existingScreeningProfile.isDefault) {
      throw new BadRequest('Default screening profile cannot be deleted')
    }
    return this.screeningProfileRepository.deleteScreeningProfile(
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
    counterRepository: CounterRepository,
    acurisSanctionsSearchType?: AcurisSanctionsSearchType[]
  ) {
    const mongoSanctionSourcesRepository = new MongoSanctionSourcesRepository(
      this.mongoDb,
      getSanctionsSourceDocumentsCollectionName([SanctionsDataProviders.ACURIS])
    )
    const sources = await mongoSanctionSourcesRepository.getSanctionsSources(
      undefined,
      [],
      true
    )

    const sanctionSourceIds = sources
      .filter((source) => source.sourceType === 'SANCTIONS')
      .map((source) => source.id)
      .filter((id): id is string => id !== undefined)
    const pepSourceIds = sources
      .filter((source) => source.sourceType === 'PEP')
      .map((source) => source.id)
      .filter((id): id is string => id !== undefined)
    const relSourceIds = sources
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
            relevance: REL_SOURCE_RELEVANCES,
          },
        }
      ),

      ...this.createSourceConfig(
        acurisSanctionsSearchType,
        'ADVERSE_MEDIA' as AcurisSanctionsSearchType,
        {
          adverseMedia: {
            relevance: ADVERSE_MEDIA_SOURCE_RELEVANCES,
          },
        }
      ),
    }

    await this.createScreeningProfile(
      defaultScreeningProfile,
      counterRepository
    )
  }

  public async checkIfDefaultScreeningProfileExists(): Promise<boolean> {
    const screeningProfiles = await this.getScreeningProfiles()
    return screeningProfiles.items.some((profile) => profile.isDefault)
  }
}
