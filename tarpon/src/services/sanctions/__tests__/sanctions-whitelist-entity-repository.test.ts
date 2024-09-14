import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsWhitelistEntityRepository } from '@/services/sanctions/repositories/sanctions-whitelist-entity-repository'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'

dynamoDbSetupHook()

const SUBJECT_1 = {
  userId: 'test_business_user_id',
  entityType: 'DIRECTOR',
  searchTerm: 'John Dow',
} as const

const SUBJECT_2 = {
  userId: 'test_business_user_id_2',
  entityType: 'DIRECTOR',
  searchTerm: 'Vladimir Putin',
} as const

describe('Whitelist repository', () => {
  const TEST_TENANT_ID = getTestTenantId()

  describe('Matching', () => {
    let repo: SanctionsWhitelistEntityRepository
    beforeAll(async () => {
      const mongoDb = await getMongoDbClient()
      repo = new SanctionsWhitelistEntityRepository(TEST_TENANT_ID, mongoDb)
    })
    beforeEach(async () => {
      await repo.clear()
    })

    test('Adding entries should not duplicate', async () => {
      await repo.addWhitelistEntities([SAMPLE_HIT_1], SUBJECT_1)
      await repo.addWhitelistEntities([SAMPLE_HIT_1], SUBJECT_1)
      const entries = await repo.getWhitelistEntities(
        [SAMPLE_HIT_1?.id as string],
        SUBJECT_1
      )
      expect(entries).toHaveLength(1)
    })

    describe('Single entity in list', () => {
      beforeEach(async () => {
        await repo.addWhitelistEntities([SAMPLE_HIT_1], SUBJECT_1)
      })

      test('Should not match with partial subject match', async () => {
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_1?.id as string], {
            userId: SUBJECT_1.userId,
          })
        ).toBe(false)
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_1?.id as string], {
            userId: SUBJECT_1.userId,
            entityType: SUBJECT_1.entityType,
          })
        ).toBe(false)
      })

      test('Should match when subject matches fully', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1?.id as string],
            SUBJECT_1
          )
        ).toBe(true)
      })

      test('Should not match when subject matches fully but for other entity', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_2?.id as string],
            SUBJECT_1
          )
        ).toBe(false)
      })
    })

    describe('Multiple whitelist entities with the same subject', () => {
      beforeEach(async () => {
        await repo.addWhitelistEntities([SAMPLE_HIT_1, SAMPLE_HIT_2], SUBJECT_1)
      })

      test('Should not match with partial subject match', async () => {
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_1?.id as string], {
            userId: SUBJECT_1.userId,
          })
        ).toBe(false)
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_2?.id as string], {
            userId: SUBJECT_1.userId,
          })
        ).toBe(false)
      })

      test('Should match when subject matches fully for both entities', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1?.id as string],
            SUBJECT_1
          )
        ).toBe(true)
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_2?.id as string],
            SUBJECT_1
          )
        ).toBe(true)
      })
      test('Should match when subject matches fully for any entities', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1?.id as string, SAMPLE_HIT_2?.id as string],
            SUBJECT_1
          )
        ).toBe(true)
      })
    })

    describe('Multiple whitelist entities with the different subjects', () => {
      beforeEach(async () => {
        await repo.addWhitelistEntities([SAMPLE_HIT_1], SUBJECT_1)
        await repo.addWhitelistEntities([SAMPLE_HIT_2], SUBJECT_2)
      })

      test('Should not match with partial subject match', async () => {
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_1?.id as string], {
            userId: SUBJECT_1.userId,
          })
        ).toBe(false)
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_2?.id as string], {
            userId: SUBJECT_2.userId,
          })
        ).toBe(false)
      })

      test('Should not match when subject matches fully but entity is is not', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1.id as string],
            SUBJECT_2
          )
        ).toBe(false)
      })

      test('Should match when subject matches fully for at least one', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1.id as string, SAMPLE_HIT_2.id as string],
            SUBJECT_1
          )
        ).toBe(true)
      })
    })
  })
})

const SAMPLE_HIT_1: SanctionsEntity = {
  id: 'LIZCQ58HX6MYKMO',
  updatedAt: new Date('2024-06-20T10:09:30Z').getTime(),
  types: ['adverse-media'],
  name: 'Vladimir Putiin',
  entityType: 'person',
  aka: ['Vladimir Putin'],
  sanctionsSources: [
    {
      countryCodes: ['AU', 'CZ'],
      name: 'company AM',
    },
  ],
}
const SAMPLE_HIT_2: SanctionsEntity = {
  id: 'XXXXXXXXXXXXXX1',
  updatedAt: new Date('2024-06-20T10:09:30Z').getTime(),
  types: ['adverse-media'],
  name: 'Igor Sechin',
  entityType: 'person',
  aka: ['Igor Sechin'],
  sanctionsSources: [
    {
      countryCodes: ['AU', 'CZ'],
      name: 'company AM',
    },
  ],
}
