import compact from 'lodash/compact'
import { migrateAllTenants } from '../utils/tenant'
import {
  bulkUpdateUserSearch,
  createIndexIfNotExists,
  getSharedOpensearchClient,
  isOpensearchAvailableInRegion,
} from '@/utils/opensearch-utils'
import { Tenant } from '@/@types/tenant'
import { isDemoTenant } from '@/utils/tenant-id'
import { hasFeature } from '@/core/utils/context'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getOngoingScreeningRuleInstances } from '@/services/batch-jobs/ongoing-screening-user-rule-batch-job-runner'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { USERS_COLLECTION } from '@/utils/mongo-table-names'
import { getSearchIndexName } from '@/utils/mongodb-definitions'
import { envIsNot } from '@/utils/env'
import { UserDetails } from '@/@types/openapi-public/UserDetails'
import { LegalEntity } from '@/@types/openapi-internal/LegalEntity'
import { Person } from '@/@types/openapi-public/Person'
import { formatConsumerName } from '@/utils/helpers'
import { UserSearchEntity } from '@/@types/openapi-internal/UserSearchEntity'
import { USER_SEARCH_INDEX_DEFINITION } from '@/utils/opensearch-definitions'

async function migrateTenant(tenant: Tenant) {
  if (envIsNot('prod')) {
    return
  }
  if (isDemoTenant(tenant.id)) {
    return
  }
  if (!isOpensearchAvailableInRegion()) {
    return
  }
  if (!hasFeature('SANCTIONS')) {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const activeRuleInstances =
    await ruleInstanceRepository.getActiveRuleInstances('USER')
  const ongoingScreeningRuleInstances = getOngoingScreeningRuleInstances(
    activeRuleInstances,
    hasFeature('RISK_LEVELS')
  )

  if (ongoingScreeningRuleInstances.length === 0) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const usersCollection = db.collection<InternalUser>(
    USERS_COLLECTION(tenant.id)
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
  const indexName = getSearchIndexName(USERS_COLLECTION(tenant.id))
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

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
