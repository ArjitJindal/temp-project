import {
  getMigrationLastCompletedId,
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedId,
  updateMigrationLastCompletedTimestamp,
} from '../migration-progress'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

withFeaturesToggled([], ['CLICKHOUSE_ENABLED', 'CLICKHOUSE_MIGRATION'], () => {
  describe('Migration Progress Tracking', () => {
    const MIGRATION_NAME = 'test-backfill-migration'
    const INITIAL_TIMESTAMP = 1718332800
    const UPDATED_TIMESTAMP = 1718332801
    const INITIAL_ID = 'initial-migration-id-123'
    const UPDATED_ID = 'updated-migration-id-456'

    describe('Timestamp Tracking', () => {
      it('should correctly retrieve the last completed timestamp after an initial update', async () => {
        await updateMigrationLastCompletedTimestamp(
          MIGRATION_NAME,
          INITIAL_TIMESTAMP
        )
        const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
          MIGRATION_NAME
        )
        expect(lastCompletedTimestamp).toBe(INITIAL_TIMESTAMP)
      })

      it('should update the last completed timestamp to a new value', async () => {
        await updateMigrationLastCompletedTimestamp(
          MIGRATION_NAME,
          INITIAL_TIMESTAMP
        )
        await updateMigrationLastCompletedTimestamp(
          MIGRATION_NAME,
          UPDATED_TIMESTAMP
        )
        const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
          MIGRATION_NAME
        )
        expect(lastCompletedTimestamp).toBe(UPDATED_TIMESTAMP)
      })
    })

    describe('ID Tracking', () => {
      it('should correctly retrieve the last completed ID after an initial update', async () => {
        await updateMigrationLastCompletedId(MIGRATION_NAME, INITIAL_ID)
        const lastCompletedId = await getMigrationLastCompletedId(
          MIGRATION_NAME
        )
        expect(lastCompletedId).toBe(INITIAL_ID)
      })

      it('should update the last completed ID to a new value', async () => {
        await updateMigrationLastCompletedId(MIGRATION_NAME, INITIAL_ID)
        await updateMigrationLastCompletedId(MIGRATION_NAME, UPDATED_ID)
        const lastCompletedId = await getMigrationLastCompletedId(
          MIGRATION_NAME
        )
        expect(lastCompletedId).toBe(UPDATED_ID)
      })
    })
  })
})
