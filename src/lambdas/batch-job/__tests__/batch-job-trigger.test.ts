import { SQSEvent } from 'aws-lambda'
import { StartExecutionCommand } from '@aws-sdk/client-sfn'
import { createSqsEvent } from '@/test-utils/sqs-test-utils'
import { BatchJob } from '@/@types/batch-job'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

describe('Batch job trigger', () => {
  const mockSfnSend = jest.fn()
  const MOCK_BATCH_JOB_STATE_MACHINE_ARN = 'mock-sfn-arn'
  let jobTriggerHandler: (event: SQSEvent) => void

  beforeAll(async () => {
    process.env.BATCH_JOB_STATE_MACHINE_ARN = MOCK_BATCH_JOB_STATE_MACHINE_ARN
    jest.mock('@aws-sdk/client-sfn', () => {
      return {
        ...jest.requireActual('@aws-sdk/client-sfn'),
        SFNClient: class {
          send(command: StartExecutionCommand) {
            mockSfnSend(command)
          }
        },
      }
    })
    jobTriggerHandler = (await import('../app')).jobTriggerHandler as any as (
      event: SQSEvent
    ) => void
  })

  afterEach(() => {
    mockSfnSend.mockClear()
  })

  test('Triggers single step function to start', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const batchJob: BatchJob = {
      tenantId: TEST_TENANT_ID,
      type: 'PLACEHOLDER',
    }
    await (jobTriggerHandler as any as (event: SQSEvent) => void)(
      createSqsEvent([batchJob])
    )

    expect(mockSfnSend).toHaveBeenCalledTimes(1)
    const command = mockSfnSend.mock.calls[0][0] as StartExecutionCommand
    expect(command.input.stateMachineArn).toBe(MOCK_BATCH_JOB_STATE_MACHINE_ARN)
    const input = JSON.parse(command.input.input as string)
    expect(input).toEqual(batchJob)
  })

  test('Triggers multiple step function to start', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const batchJob: BatchJob = {
      tenantId: TEST_TENANT_ID,
      type: 'PLACEHOLDER',
    }
    await (jobTriggerHandler as any as (event: SQSEvent) => void)(
      createSqsEvent([batchJob, batchJob, batchJob])
    )

    expect(mockSfnSend).toHaveBeenCalledTimes(3)
    for (let i = 0; i < 3; i++) {
      const command = mockSfnSend.mock.calls[i][0] as StartExecutionCommand
      expect(command.input.stateMachineArn).toBe(
        MOCK_BATCH_JOB_STATE_MACHINE_ARN
      )
      const input = JSON.parse(command.input.input as string)
      expect(input).toEqual(batchJob)
    }
  })
})
