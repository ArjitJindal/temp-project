import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { CaseCaseUsers } from '@/@types/openapi-internal/CaseCaseUsers'
import { OptionalPagination } from '@/utils/pagination'
import { RuleHitDirection } from '@/@types/openapi-internal/RuleHitDirection'

export async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const caseRepository = new CaseRepository(tenant.id, {
    mongoDb: mongodb,
  })

  const queryParams: OptionalPagination<DefaultApiGetCaseListRequest> = {
    pageSize: 'DISABLED',
  }
  queryParams.afterTimestamp = 0
  queryParams.beforeTimestamp = Date.now()
  const casesCursor = await caseRepository.getCasesCursor(queryParams)

  let transactionCase = await casesCursor.next()
  while (transactionCase) {
    if (
      !transactionCase.caseUsers ||
      (!transactionCase.caseUsers.origin &&
        !transactionCase.caseUsers.destination) ||
      !transactionCase.caseTransactions ||
      transactionCase.caseTransactions.length === 0
    ) {
      transactionCase = await casesCursor.next()
      continue
    }
    const { origin, destination } = transactionCase.caseUsers

    const hitDirections: Set<RuleHitDirection> = new Set()
    for (const hitRule of transactionCase.caseTransactions[0].hitRules) {
      if (hitRule.ruleHitMeta?.hitDirections != null) {
        for (const ruleHitDirection of hitRule.ruleHitMeta.hitDirections) {
          hitDirections.add(ruleHitDirection)
        }
      }
    }
    if (!hitDirections.size) {
      const newCase = getCase(
        transactionCase,
        origin as InternalBusinessUser | InternalConsumerUser,
        'ORIGIN'
      )
      await caseRepository.addCaseMongo(newCase)
      console.log(
        `NEW CASE with type: with case ID: ${newCase.caseId} with origin User`
      )
      transactionCase = await casesCursor.next()
      continue
    }

    if (
      (origin as InternalBusinessUser | InternalConsumerUser)
        ?.createdTimestamp &&
      hitDirections.has('ORIGIN')
    ) {
      console.log(
        `Migrating Case ${transactionCase.caseId} with user: ${origin?.userId}`
      )

      const newCase = getCase(
        transactionCase,
        origin as InternalBusinessUser | InternalConsumerUser,
        'ORIGIN'
      )
      await caseRepository.addCaseMongo(newCase)
      console.log(`NEW CASE with case ID: ${newCase.caseId} with origin User`)
    }
    if (
      (destination as InternalBusinessUser | InternalConsumerUser)
        ?.createdTimestamp &&
      hitDirections.has('DESTINATION') &&
      !hitDirections.has('ORIGIN')
    ) {
      console.log(
        `Migrating Case ${transactionCase.caseId} with user: ${destination?.userId}`
      )

      const newCase = getCase(
        transactionCase,
        destination as InternalBusinessUser | InternalConsumerUser,
        'DESTINATION'
      )
      await caseRepository.addCaseMongo(newCase)
      console.log(`NEW CASE with case ID: ${newCase.caseId} with origin User`)
    }
    transactionCase = await casesCursor.next()
  }
}

function getCase(
  transactionCase: Case,
  user: InternalBusinessUser | InternalConsumerUser,
  hitDirection: RuleHitDirection
): Case {
  const caseUsers: CaseCaseUsers = {}

  // in case user not in db yet
  if (hitDirection === 'ORIGIN') {
    caseUsers.origin = user
  } else {
    caseUsers.destination = user
  }

  const caseEntity: Case = {
    ...transactionCase,
    caseUsers: caseUsers,
  }
  return caseEntity
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skipping
}
