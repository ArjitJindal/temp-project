import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils/env'
import compact from 'lodash/compact'
import { TenantService } from '../tenants'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { getOngoingScreeningRuleInstances } from './ongoing-screening-user-rule-batch-job-runner'
import { USERS_COLLECTION } from '@/utils/mongo-table-names'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { BackfillOpensearchUsersIndexBatchJob } from '@/@types/batch-job'
import { tenantHasFeature } from '@/core/utils/context'
import { envIsNot } from '@/utils/env'
import { isDemoTenant } from '@/utils/tenant-id'
import {
  bulkUpdateUserSearch,
  createIndexIfNotExists,
  getSharedOpensearchClient,
  isOpensearchAvailableInRegion,
} from '@/utils/opensearch-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UserDetails } from '@/@types/openapi-public/UserDetails'
import { LegalEntity } from '@/@types/openapi-public/LegalEntity'
import { Person } from '@/@types/openapi-public/Person'
import { getSearchIndexName } from '@/utils/mongodb-definitions'
import { USER_SEARCH_INDEX_DEFINITION } from '@/utils/opensearch-definitions'
import { UserSearchEntity } from '@/@types/openapi-internal/UserSearchEntity'
import { formatConsumerName } from '@/utils/helpers'

export class BackfillOpensearchUsersIndexBatchJobRunner extends BatchJobRunner {
  async run(_job: BackfillOpensearchUsersIndexBatchJob) {
    const [stage, region] = stageAndRegion()
    const config = getTarponConfig(stage, region)
    const tenantInfos = await TenantService.getAllTenants(
      config.stage,
      config.region
    )
    for (const tenantInfo of tenantInfos) {
      const tenantId = tenantInfo.tenant.id
      await this.migrateTenant(tenantId)
    }
  }

  async migrateTenant(tenantId: string) {
    if (envIsNot('prod')) {
      return
    }
    if (isDemoTenant(tenantId)) {
      return
    }
    if (!isOpensearchAvailableInRegion()) {
      return
    }
    if (!tenantHasFeature(tenantId, 'SANCTIONS')) {
      return
    }
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const activeRuleInstances =
      await ruleInstanceRepository.getActiveRuleInstances('USER')
    const ongoingScreeningRuleInstances = getOngoingScreeningRuleInstances(
      activeRuleInstances,
      await tenantHasFeature(tenantId, 'RISK_LEVELS')
    )

    if (ongoingScreeningRuleInstances.length === 0) {
      return
    }
    const mongoDb = await getMongoDbClient()
    const db = mongoDb.db()
    const usersCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenantId)
    )
    const usersCursor = usersCollection.aggregate<{
      userId: string
      userDetails: UserDetails
      legalEntity: LegalEntity
      directors: Person[]
      shareHolders: Person[]
      type: 'CONSUMER' | 'BUSINESS'
    }>([
      {
        $match: {
          createdTimestamp: { $ne: null },
        },
      },
      {
        project: {
          userId: 1,
          userDetails: 1,
          legalEntity: 1,
          directors: 1,
          shareHolders: 1,
          type: 1,
        },
      },
    ])
    const client = await getSharedOpensearchClient()
    const indexName = getSearchIndexName(USERS_COLLECTION(tenantId))
    await createIndexIfNotExists(
      client,
      indexName,
      USER_SEARCH_INDEX_DEFINITION(indexName)
    )
    await processCursorInBatch(
      usersCursor,
      async (users) => {
        const entities: UserSearchEntity[] = users.map((user) => {
          if (user.type === 'BUSINESS') {
            return {
              id: user.userId,
              legalEntityName: user.legalEntity.companyGeneralDetails.legalName,
              shareHoldersNames: compact(
                user.shareHolders.map((shareHolder) =>
                  formatConsumerName(shareHolder.generalDetails?.name)
                )
              ),
              directorsNames: compact(
                user.directors.map((director) =>
                  formatConsumerName(director.generalDetails?.name)
                )
              ),
            }
          }
          return {
            id: user.userId,
            userName: formatConsumerName(user.userDetails?.name),
          }
        })
        await bulkUpdateUserSearch(entities, indexName, client)
      },
      {
        mongoBatchSize: 1000,
        processBatchSize: 1000,
      }
    )
  }
}
