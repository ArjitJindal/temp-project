import { Collection, MongoClient } from 'mongodb'
import pMap from 'p-map'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { compact, omit, startCase, uniq } from 'lodash'
import { sanitizeString } from '@flagright/lib/utils'
import { GenericSanctionsConsumerUserRuleParameters } from '../rules-engine/user-rules/generic-sanctions-consumer-user'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { SanctionsDataProvider } from '../sanctions/providers/types'
import { OpenSanctionsProvider } from '../sanctions/providers/open-sanctions-provider'
import { SanctionsSearchRepository } from '../sanctions/repositories/sanctions-search-repository'
import { CounterRepository } from '../counter/repository'
import { RuleInstanceService } from '../rules-engine/rule-instance-service'
import { FEATURE_FLAG_PROVIDER_MAP } from '../sanctions/utils'
import { AcurisProvider } from '../sanctions/providers/acuris-provider'
import { ScreeningProfileService } from '../screening-profile'
import { BatchJobRunner } from './batch-job-runner-base'
import { InHouseScreeningMigrationBatchJob } from '@/@types/batch-job'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import {
  SANCTIONS_SEARCHES_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { logger } from '@/core/logger'
import {
  getMigrationLastCompletedId,
  updateMigrationLastCompletedId,
} from '@/utils/migration-progress'
import { Feature } from '@/@types/openapi-internal/Feature'

export class InHouseScreeningMigrationBatchJobRunner extends BatchJobRunner {
  provider: SanctionsDataProviderName = 'open-sanctions'
  whitelistEntitiesTempCollection!: Collection<SanctionsWhitelistEntity>
  whitelistEntitiesCollection!: Collection<SanctionsWhitelistEntity>
  sanctionsSearchesCollection!: Collection<SanctionsSearchHistory>
  dataProvider!: SanctionsDataProvider
  searchRepository!: SanctionsSearchRepository
  counterRepository!: CounterRepository
  ruleInstanceService!: RuleInstanceService
  tenantRepository!: TenantRepository
  tenantId!: string

  private async init(
    tenantId: string,
    mongoDb: MongoClient,
    dynamoDb: DynamoDBDocumentClient,
    provider: SanctionsDataProviderName
  ) {
    const db = mongoDb.db()
    this.provider = provider
    this.tenantId = tenantId
    this.ruleInstanceService = new RuleInstanceService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    this.whitelistEntitiesCollection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenantId)
    )
    this.sanctionsSearchesCollection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(tenantId)
    )
    this.dataProvider =
      provider === 'open-sanctions'
        ? await OpenSanctionsProvider.build(tenantId, {
            mongoDb,
            dynamoDb,
          })
        : await AcurisProvider.build(tenantId, {
            mongoDb,
            dynamoDb,
          })
    this.searchRepository = new SanctionsSearchRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
    this.counterRepository = new CounterRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
    this.tenantRepository = new TenantRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
  }
  protected async run(job: InHouseScreeningMigrationBatchJob) {
    const { parameters, tenantId } = job
    const { settings, providers } = parameters
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    await this.init(tenantId, mongoDb, dynamoDb, providers[0])
    const lastCompletedId =
      (await getMigrationLastCompletedId(
        `IN_HOUSE_SCREENING_MIGRATION-${tenantId}`
      )) ?? '0'
    const cursor = this.whitelistEntitiesCollection
      .find({
        sanctionsWhitelistId: { $gt: lastCompletedId },
      })
      .sort({
        sanctionsWhitelistId: 1,
      })
      .addCursorFlag('noCursorTimeout', true)
    await processCursorInBatch(cursor, (batch) => this.processHits(batch))

    logger.info('Whitelist entities processed')
    const r16Rule = await this.getTenantR16Rule()
    if (r16Rule) {
      await this.handleRuleInstance(r16Rule, {
        mongoDb,
        dynamoDb,
      })
    }
    const tenantSettings = await this.tenantRepository?.getTenantSettings()
    const features = compact(
      Object.entries(FEATURE_FLAG_PROVIDER_MAP).map(([key, val]) => {
        if (providers.includes(val)) {
          return key as Feature
        }
        return null
      })
    )
    await this.tenantRepository?.createOrUpdateTenantSettings({
      features: uniq([...(tenantSettings?.features || []), ...features]),
      sanctions: {
        ...(tenantSettings?.sanctions || {}),
        providerScreeningTypes: settings,
      },
    })
    logger.info('Tenant settings updated')
  }

  private async processHits(whitelistEntities: SanctionsWhitelistEntity[]) {
    const newRecords: SanctionsWhitelistEntity[] = []
    const whitelistSet = new Set<string>()
    await pMap(
      whitelistEntities,
      async (whitelistEntity) => {
        if (whitelistEntity.sanctionsWhitelistId.includes(this.provider)) {
          return
        }
        const whitelistIdentifier =
          whitelistEntity.userId ?? whitelistEntity.paymentMethodId ?? ''
        try {
          const searchTerm =
            whitelistEntity.searchTerm ?? whitelistEntity.sanctionsEntity?.name
          if (searchTerm && this.dataProvider && this.searchRepository) {
            const request: SanctionsSearchRequest | undefined = (
              await this.sanctionsSearchesCollection
                .find({
                  'request.searchTerm': {
                    $regex: `^${startCase(searchTerm)}$`,
                    $options: 'i',
                  },
                })
                .sort({
                  createdAt: -1,
                })
                .limit(1)
                .toArray()
            )?.[0]?.request

            if (request) {
              const response = (
                await this.dataProvider.search(
                  {
                    ...request,
                    fuzzinessRange: { upperBound: 100, lowerBound: 0 },
                    manualSearch: true,
                  },
                  true
                )
              ).data as SanctionsEntity[]
              const sanctionsEntityMatch = this.getSanctionsEntityMatch(
                response ?? [],
                whitelistEntity.sanctionsEntity
              )
              if (sanctionsEntityMatch.length > 0 && this.counterRepository) {
                for (const entity of sanctionsEntityMatch) {
                  const id =
                    await this.counterRepository.getNextCounterAndUpdate(
                      'SanctionsWhitelist'
                    )
                  if (whitelistSet.has(`${whitelistIdentifier}-${entity.id}`)) {
                    continue
                  }
                  newRecords.push({
                    ...omit(whitelistEntity, ['_id']),
                    provider: this.provider,
                    sanctionsWhitelistId: `SW-${id}-${this.provider}`,
                    createdAt: Date.now(),
                    sanctionsEntity: entity,
                  })
                  whitelistSet.add(`${whitelistIdentifier}-${entity.id}`)
                }
              }
            } else if (this.dataProvider && this.searchRepository) {
              const request: SanctionsSearchRequest = {
                types: whitelistEntity.sanctionsEntity?.sanctionSearchTypes,
                searchTerm,
                fuzzinessRange: { upperBound: 100, lowerBound: 0 },
                manualSearch: true,
              }
              const response = await this.dataProvider.search(request, true)
              const sanctionsEntityMatch = this.getSanctionsEntityMatch(
                response.data ?? [],
                whitelistEntity.sanctionsEntity
              )
              if (sanctionsEntityMatch.length > 0 && this.counterRepository) {
                const newRecords: SanctionsWhitelistEntity[] = []
                const id = await this.counterRepository.getNextCounterAndUpdate(
                  'SanctionsWhitelist'
                )
                for (const entity of sanctionsEntityMatch) {
                  if (whitelistSet.has(`${whitelistIdentifier}-${entity.id}`)) {
                    continue
                  }
                  newRecords.push({
                    ...omit(whitelistEntity, ['_id']),
                    provider: this.provider,
                    sanctionsWhitelistId: `SW-${id}-${this.provider}`,
                    createdAt: Date.now(),
                    sanctionsEntity: entity,
                  })
                  whitelistSet.add(`${whitelistIdentifier}-${entity.id}`)
                }
              }
            }
          }
          await updateMigrationLastCompletedId(
            `IN_HOUSE_SCREENING_MIGRATION-${this.tenantId}`,
            whitelistEntity.sanctionsWhitelistId
          )
        } catch (e) {
          console.log(e)
        }
      },
      {
        concurrency: 100,
      }
    )
    if (newRecords.length > 0) {
      await this.whitelistEntitiesCollection.insertMany(newRecords)
    }
  }

  private getSanctionsEntityMatch(
    hits: SanctionsEntity[],
    whitelistEntity: SanctionsEntity
  ) {
    return hits.filter((hit) => this.isTrueMatch(hit, whitelistEntity))
  }

  private isTrueMatch(hit: SanctionsEntity, whitelistEntity: SanctionsEntity) {
    const whitelistEntityNames = [
      whitelistEntity.name,
      ...(whitelistEntity.aka || []),
    ].map((name) => sanitizeString(name))
    const nameMatch = [hit.name, ...(hit.aka || [])].some((name) =>
      whitelistEntityNames.some((whitelistName) => whitelistName === name)
    )
    if (!nameMatch) {
      return false
    }
    if (
      hit.yearOfBirth &&
      whitelistEntity.yearOfBirth &&
      hit.yearOfBirth.length > 0 &&
      whitelistEntity.yearOfBirth.length > 0
    ) {
      return hit.yearOfBirth.some((year) =>
        whitelistEntity.yearOfBirth?.includes(year)
      )
    }
    return true
  }

  private async getTenantR16Rule() {
    const ruleInstances = await this.ruleInstanceService.getActiveRuleInstances(
      'USER'
    )
    return ruleInstances.find((ruleInstance) => ruleInstance.ruleId === 'R-16')
  }

  private async handleRuleInstance(
    ruleInstance: RuleInstance,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    const parameters = ruleInstance.parameters
    const ruleInstanceId = await this.ruleInstanceService?.getNewRuleInstanceId(
      'R-17'
    )
    const screeningProfileService = new ScreeningProfileService(
      this.tenantId,
      connections
    )
    const screeningProfiles =
      await screeningProfileService.getScreeningProfiles()
    const defaultScreeningProfileId = screeningProfiles.items.find(
      (profile) => profile.isDefault
    )?.screeningProfileId

    const newRuleParameters: GenericSanctionsConsumerUserRuleParameters = {
      screeningTypes: parameters.screeningTypes,
      fuzzinessRange: {
        lowerBound: 0,
        upperBound: parameters.fuzziness,
      },
      screeningValues: ['YOB'],
      fuzzinessSetting: 'LEVENSHTEIN_DISTANCE_DEFAULT',
      ruleStages: ['INITIAL', 'UPDATE', 'ONGOING'],
      screeningProfileId: defaultScreeningProfileId ?? '',
    }
    await this.ruleInstanceService?.createOrUpdateRuleInstance({
      ruleId: 'R-17',
      ruleNameAlias: 'Screening consumer users',
      ruleDescriptionAlias: 'Screening on consumer users with data providers',
      parameters: newRuleParameters,
      riskLevelParameters: {
        VERY_HIGH: newRuleParameters,
        HIGH: newRuleParameters,
        MEDIUM: newRuleParameters,
        LOW: newRuleParameters,
        VERY_LOW: newRuleParameters,
      },
      riskLevelActions: ruleInstance.riskLevelActions,
      id: ruleInstanceId,
      type: 'USER',
      casePriority: ruleInstance.casePriority,
      nature: 'SCREENING',
      labels: [],
      createdBy: 'SYSTEM',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      checksFor: [],
      filters: {},
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
      status: 'ACTIVE',
    })
    await this.ruleInstanceService?.createOrUpdateRuleInstance({
      ...ruleInstance,
      status: 'INACTIVE',
    })
    logger.info('Rule instance updated')
  }
}
