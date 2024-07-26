import { isEqual } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsSearchRepository } from '@/services/sanctions/repositories/sanctions-search-repository'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { formatConsumerName } from '@/utils/helpers'
import dayjs from '@/utils/dayjs'

const cache: { [searchId: string]: SanctionsSearchHistory | null | undefined } =
  {}
async function getSearchById(
  searchRepository,
  searchId: string
): Promise<SanctionsSearchHistory | null> {
  if (searchId in cache) {
    return cache[searchId] ?? null
  }
  const searchResult = await searchRepository.getSearchResult(searchId)
  cache[searchId] = searchResult
  return searchResult ?? null
}

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const searchRepository = new SanctionsSearchRepository(tenant.id, mongoDb)
  const userRepository = new UserRepository(tenant.id, {
    mongoDb,
  })
  const hitsRepository = new SanctionsHitsRepository(tenant.id, mongoDb)
  let counter = 0
  for await (const hit of hitsRepository.iterateHits()) {
    const hitContext = hit.hitContext
    let newHitContext = {
      ...hitContext,
    }
    if (
      (hitContext != null &&
        hitContext.userId != null &&
        hitContext.entity === 'USER' &&
        hitContext.entityType == null) ||
      hitContext?.yearOfBirth == null ||
      hitContext?.searchTerm == null
    ) {
      const searchResult = await getSearchById(searchRepository, hit.searchId)
      if (searchResult != null) {
        // Calc entity type
        const searchTerm = searchResult.request.searchTerm
        const yearOfBirth = searchResult.request.yearOfBirth
        if (
          hitContext != null &&
          hitContext.userId != null &&
          hitContext.entity === 'USER' &&
          hitContext.entityType == null
        ) {
          let newEntityType
          const _user = await userRepository.getMongoUser(hitContext.userId)
          const user = _user as
            | InternalConsumerUser
            | InternalBusinessUser
            | null
          if (user?.type === 'BUSINESS') {
            const business = user as InternalBusinessUser
            if (
              searchTerm ===
              business.legalEntity.companyGeneralDetails.legalName
            ) {
              newEntityType = 'LEGAL_NAME'
            } else if (
              business.directors?.some((person) => {
                const name =
                  formatConsumerName(person.generalDetails.name) || ''
                const year = person.generalDetails.dateOfBirth
                  ? dayjs(person.generalDetails.dateOfBirth).year()
                  : undefined
                return (
                  searchTerm === name ||
                  (yearOfBirth != null && yearOfBirth === year)
                )
              })
            ) {
              newEntityType = 'DIRECTOR'
            } else if (
              business.shareHolders?.some((person) => {
                const name =
                  formatConsumerName(person.generalDetails.name) || ''
                const year = person.generalDetails.dateOfBirth
                  ? dayjs(person.generalDetails.dateOfBirth).year()
                  : undefined
                return (
                  searchTerm === name ||
                  (yearOfBirth != null && yearOfBirth === year)
                )
              })
            ) {
              newEntityType = 'SHAREHOLDER'
            }
          } else if (user?.type === 'CONSUMER') {
            const consumer = user as InternalConsumerUser
            const userYearOfBirth =
              consumer.userDetails && consumer.userDetails.dateOfBirth
                ? dayjs(consumer.userDetails.dateOfBirth).year()
                : undefined

            if (
              formatConsumerName(consumer.userDetails?.name) === searchTerm ||
              (userYearOfBirth && userYearOfBirth === yearOfBirth)
            ) {
              newEntityType = 'CONSUMER_NAME'
            }
          }
          if (
            newEntityType != null &&
            newEntityType !== hitContext.entityType
          ) {
            newHitContext = {
              ...newHitContext,
              entityType: newEntityType,
            }
          }
        }

        if (yearOfBirth != null) {
          newHitContext = {
            ...newHitContext,
            yearOfBirth,
          }
        }
        if (searchTerm != null) {
          newHitContext = {
            ...newHitContext,
            searchTerm,
          }
        }
      }
      if (!isEqual(newHitContext, hitContext)) {
        logger.info(`Migrating hit ${hit.sanctionsHitId} (${++counter})`)
        await hitsRepository.updateHitsByIds([hit.sanctionsHitId], {
          hitContext: newHitContext,
        })
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
