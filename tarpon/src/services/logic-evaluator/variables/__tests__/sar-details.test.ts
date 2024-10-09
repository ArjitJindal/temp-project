import { SAR_DETAILS } from '../sar-details'
import { ReportRepository } from '@/services/sar/repositories/report-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTestUser } from '@/test-utils/user-test-utils'

dynamoDbSetupHook()
describe('sar-details', () => {
  test('sarDetails', async () => {
    const tenantId = getTestTenantId()
    const mongoDb = await getMongoDbClient()
    const reportRepository = new ReportRepository(
      tenantId,
      mongoDb,
      getDynamoDbClient()
    )
    await reportRepository.addOrUpdateSarItemsInDynamo('U-1', {
      reportId: '1',
      status: 'SUBMISSION_SUCCESSFUL',
      region: 'US',
    })
    const user = getTestUser({
      userId: 'U-1',
    })
    const varData = await SAR_DETAILS.load(user, {
      tenantId,
      dynamoDb: getDynamoDbClient(),
    })
    expect(varData).toEqual([
      {
        reportId: '1',
        status: 'SUBMISSION_SUCCESSFUL',
        region: 'US',
      },
    ])
  })
})
