import { Collection, MongoClient } from 'mongodb'
import pMap from 'p-map'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { compact, uniq } from 'lodash'
import { GenericSanctionsConsumerUserRuleParameters } from '../rules-engine/user-rules/generic-sanctions-consumer-user'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { SanctionsDataProvider } from '../sanctions/providers/types'
import { OpenSanctionsProvider } from '../sanctions/providers/open-sanctions-provider'
import { SanctionsSearchRepository } from '../sanctions/repositories/sanctions-search-repository'
import { CounterRepository } from '../counter/repository'
import { RuleInstanceService } from '../rules-engine/rule-instance-service'
import { FEATURE_FLAG_PROVIDER_MAP } from '../sanctions/utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { InHouseScreeningMigrationBatchJob } from '@/@types/batch-job'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import {
  SANCTIONS_HITS_COLLECTION,
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
  hitsCollection!: Collection<SanctionsHit>
  whitelistEntitiesCollection!: Collection<SanctionsWhitelistEntity>
  sanctionsSearchesCollection!: Collection<SanctionsSearchHistory>
  dataProvider!: SanctionsDataProvider
  searchRepository!: SanctionsSearchRepository
  collator!: Intl.Collator
  counterRepository!: CounterRepository
  ruleInstanceService!: RuleInstanceService
  tenantRepository!: TenantRepository
  tenantId!: string
  private async init(
    tenantId: string,
    mongoDb: MongoClient,
    dynamoDb: DynamoDBClient
  ) {
    const db = mongoDb.db()
    this.tenantId = tenantId
    this.ruleInstanceService = new RuleInstanceService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    this.collator = new Intl.Collator('en-US', {
      sensitivity: 'base',
      ignorePunctuation: true,
    })
    this.hitsCollection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(tenantId)
    )
    this.whitelistEntitiesCollection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenantId)
    )
    this.sanctionsSearchesCollection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(tenantId)
    )
    this.dataProvider = await OpenSanctionsProvider.build(tenantId)
    this.searchRepository = new SanctionsSearchRepository(tenantId, mongoDb)
    this.counterRepository = new CounterRepository(tenantId, mongoDb)
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
    await this.init(tenantId, mongoDb, dynamoDb)
    const lastCompletedId =
      (await getMigrationLastCompletedId(
        `IN_HOUSE_SCREENING_MIGRATION-${tenantId}`
      )) ?? '0'
    const cursor = this.hitsCollection
      .find({
        sanctionsHitId: { $gt: lastCompletedId },
      })
      .sort({
        sanctionsHitId: 1,
      })
    await processCursorInBatch(cursor, this.processHits.bind(this))
    logger.info('Hits processed')
    const r16Rule = await this.getTenantR16Rule()
    if (r16Rule) {
      await this.handleRuleInstance(r16Rule)
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

  private async processHits(hits: SanctionsHit[]) {
    await pMap(
      hits,
      async (hit) => {
        const hitContext = hit.hitContext
        const subject = {
          userId: hitContext?.userId,
          entity: hitContext?.entity,
          entityType: hitContext?.entityType,
          searchTerm: hitContext?.searchTerm,
        }
        const complyAdvantageProviderName: SanctionsDataProviderName =
          'comply-advantage'
        const filters = [
          {
            $or: [
              { 'sanctionsEntity.id': hit.entity.id },
              { 'caEntity.id': hit.entity.id },
            ],
          },
          {
            provider: complyAdvantageProviderName,
          },
          ...Object.keys(subject).map((key) => ({
            $or: [{ [key]: subject[key] }, { [key]: { $eq: null } }],
          })),
        ]
        const whitelistEntity = await this.whitelistEntitiesCollection.findOne({
          $and: filters,
        })
        if (whitelistEntity && this.dataProvider && this.searchRepository) {
          const request: SanctionsSearchRequest | undefined = (
            await this.sanctionsSearchesCollection.findOne({
              _id: hit.searchId,
            })
          )?.request
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
              response,
              hit.entity
            )
            if (sanctionsEntityMatch.length > 0 && this.counterRepository) {
              const newRecords: SanctionsWhitelistEntity[] = []
              for (const entity of sanctionsEntityMatch) {
                const id = await this.counterRepository.getNextCounterAndUpdate(
                  'SanctionsWhitelist'
                )
                newRecords.push({
                  provider: this.provider,
                  sanctionsWhitelistId: `SW-${id}`,
                  createdAt: Date.now(),
                  sanctionsEntity: entity,
                  userId: subject.userId,
                  entity: subject.entity,
                  entityType: subject.entityType,
                  searchTerm: subject.searchTerm,
                  ...(whitelistEntity.reason && {
                    reason: whitelistEntity.reason,
                  }),
                  ...(whitelistEntity.comment && {
                    comment: whitelistEntity.comment,
                  }),
                })
              }
              await this.whitelistEntitiesCollection.insertMany(newRecords)
            }
          }
        }
        await updateMigrationLastCompletedId(
          `IN_HOUSE_SCREENING_MIGRATION-${this.tenantId}`,
          hit.sanctionsHitId
        )
      },
      {
        concurrency: 10,
      }
    )
  }

  private getSanctionsEntityMatch(
    hits: SanctionsEntity[],
    whitelistEntity: SanctionsEntity
  ) {
    return hits.filter((hit) => this.isTrueMatch(hit, whitelistEntity))
  }

  private isTrueMatch(hit: SanctionsEntity, whitelistEntity: SanctionsEntity) {
    const whitelistEntityName = [
      whitelistEntity.name,
      ...(whitelistEntity.aka || []),
    ].map((name) => name.toLowerCase())
    const nameMatch = [hit.name, ...(hit.aka || [])].some((name) =>
      whitelistEntityName.some(
        (whitelistName) => this.collator?.compare(name, whitelistName) === 0
      )
    )
    if (!nameMatch) {
      return false
    }
    if (hit.yearOfBirth && whitelistEntity.yearOfBirth) {
      return hit.yearOfBirth === whitelistEntity.yearOfBirth
    }
    return true
  }

  private async getTenantR16Rule() {
    const ruleInstances = await this.ruleInstanceService.getActiveRuleInstances(
      'USER'
    )
    return ruleInstances.find((ruleInstance) => ruleInstance.ruleId === 'R-16')
  }

  private async handleRuleInstance(ruleInstance: RuleInstance) {
    const parameters = ruleInstance.parameters
    const ruleInstanceId = await this.ruleInstanceService?.getNewRuleInstanceId(
      'R-17'
    )
    const newRuleParameters: GenericSanctionsConsumerUserRuleParameters = {
      screeningTypes: parameters.screeningTypes,
      fuzzinessRange: {
        lowerBound: 0,
        upperBound: parameters.fuzziness,
      },
      ongoingScreening: parameters.ongoingScreening,
      screeningValues: ['YOB'],
      fuzzinessSetting: 'LEVENSHTEIN_DISTANCE_DEFAULT',
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
