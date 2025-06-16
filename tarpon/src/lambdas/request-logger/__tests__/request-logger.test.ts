import { saveApiRequestLogsToDynamo } from '../app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { mockApiRequestLog } from '@/test-utils/mock-request-log'

dynamoDbSetupHook()
withFeaturesToggled(
  [],
  ['CLICKHOUSE_ENABLED', 'CLICKHOUSE_MIGRATION'],
  async () => {
    describe('RequestLogger', () => {
      it('should log request', async () => {
        const log = mockApiRequestLog()
        await saveApiRequestLogsToDynamo([log], 'flagright')
      })
    })
  }
)
