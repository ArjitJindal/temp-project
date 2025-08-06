import 'aws-sdk-client-mock-jest'
import { SQSEvent } from 'aws-lambda'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { AwsStub, mockClient } from 'aws-sdk-client-mock'
import { jobTriggerHandler as handler } from '@/lambdas/batch-job/app'
import { createSqsEvent } from '@/test-utils/sqs-test-utils'
import { BatchJobWithId } from '@/@types/batch-job'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { BatchJobTable } from '@/models/batch-job'
import { setupClickHouseForTest } from '@/test-utils/clickhouse-test-utils'

const MOCK_BATCH_JOB_STATE_MACHINE_ARN = 'mock-sfn-arn'
process.env.BATCH_JOB_STATE_MACHINE_ARN = MOCK_BATCH_JOB_STATE_MACHINE_ARN

describe('Batch job trigger', () => {
  const jobTriggerHandler = handler as any as (event: SQSEvent) => void
  let sfnMock: AwsStub<any, any, any>

  beforeEach(() => {
    sfnMock = mockClient(SFNClient as any)
  })

  test('Triggers single step function to start', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const batchJob: BatchJobWithId = {
      jobId: 'test-job-id',
      tenantId: TEST_TENANT_ID,
      type: 'DASHBOARD_REFRESH',
      parameters: { checkTimeRange: {} },
    }

    await setupClickHouseForTest(TEST_TENANT_ID, [
      BatchJobTable.tableDefinition.tableName,
    ])

    await jobTriggerHandler(createSqsEvent([batchJob]))

    expect(sfnMock).toHaveReceivedCommandTimes(StartExecutionCommand as any, 1)

    const command = sfnMock.commandCalls(StartExecutionCommand as any)[0]
      .firstArg
    expect(command.input.stateMachineArn).toBe(MOCK_BATCH_JOB_STATE_MACHINE_ARN)
    expect(JSON.parse(command.input.input as string)).toEqual(batchJob)
  })

  test('Triggers multiple step function to start', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const batchJob: BatchJobWithId = {
      jobId: 'test-job-id',
      tenantId: TEST_TENANT_ID,
      type: 'DASHBOARD_REFRESH',
      parameters: { checkTimeRange: {} },
    }

    await setupClickHouseForTest(TEST_TENANT_ID, [
      BatchJobTable.tableDefinition.tableName,
    ])

    await jobTriggerHandler(createSqsEvent([batchJob, batchJob, batchJob]))

    expect(sfnMock).toHaveReceivedCommandTimes(StartExecutionCommand as any, 3)
    for (let i = 0; i < 3; i++) {
      const command = sfnMock.commandCalls(StartExecutionCommand as any)[i]
        .firstArg
      expect(command.input.stateMachineArn).toBe(
        MOCK_BATCH_JOB_STATE_MACHINE_ARN
      )
      const input = JSON.parse(command.input.input as string)
      expect(input).toEqual(batchJob)
    }
  })
})
