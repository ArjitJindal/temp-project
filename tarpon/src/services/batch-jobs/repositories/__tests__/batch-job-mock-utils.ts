import { v4 as uuidv4 } from 'uuid'
import { BatchJob } from '@/@types/batch-job'
import { DynamoDbClickhouseBackfillBatchJobEntity } from '@/@types/openapi-internal/DynamoDbClickhouseBackfillBatchJobEntity'
import { FlatFileSchema } from '@/@types/openapi-internal/FlatFileSchema'
import { FlatFileTemplateFormat } from '@/@types/openapi-internal/FlatFileTemplateFormat'
import { NangoWebhookEvent } from '@/@types/openapi-internal/NangoWebhookEvent'
import { AggregatorName } from '@/services/rules-engine/aggregator'

export function createMockBatchJob<T extends BatchJob>(
  jobId: string | undefined,
  tenantId: string,
  type: T['type'],
  overrides: any = {}
): T & { jobId: string } {
  const finalJobId = jobId || uuidv4()

  const baseJob = {
    jobId: finalJobId,
    type,
    tenantId,
    ...overrides,
  }

  switch (type) {
    case 'RULE_PRE_AGGREGATION':
      return {
        ...baseJob,
        parameters: {
          aggregationVariables: [],
          ...overrides.parameters,
        },
        metadata: {
          tasksCount: 0,
          completeTasksCount: 0,
          ...overrides.metadata,
        },
      } as T & { jobId: string }

    case 'SANCTIONS_DATA_FETCH':
      return {
        ...baseJob,
        providers: overrides.providers || [],
        parameters: {
          from: undefined,
          entityType: undefined,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'SIMULATION_PULSE':
      return {
        ...baseJob,
        parameters: {
          taskId: uuidv4(),
          jobId: finalJobId,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'SIMULATION_RISK_FACTORS_V8':
      return {
        ...baseJob,
        parameters: {
          taskId: uuidv4(),
          jobId: finalJobId,
          sampling: {},
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'SIMULATION_BEACON':
      return {
        ...baseJob,
        parameters: {
          taskId: uuidv4(),
          jobId: finalJobId,
          defaultRuleInstance: {},
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'DEMO_MODE_DATA_LOAD':
      return baseJob as T & { jobId: string }

    case 'ONGOING_SCREENING_USER_RULE':
      return {
        ...baseJob,
        from: undefined,
        to: undefined,
        ...overrides,
      } as T & { jobId: string }

    case 'PERIODIC_SCREENING_USER_RULE':
      return baseJob as T & { jobId: string }

    case 'API_USAGE_METRICS':
      return {
        ...baseJob,
        parameters: {
          targetMonth: '2024-01',
          tenantInfos: [],
          googleSheetIds: [],
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'GLOBAL_RULE_AGGREGATION_REBUILD':
      return {
        ...baseJob,
        parameters: {
          userId: uuidv4(),
          aggregatorName: 'DEFAULT' as AggregatorName,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'DASHBOARD_REFRESH':
      return {
        ...baseJob,
        parameters: {
          checkTimeRange: {},
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'CASES_DYNAMO_BACKFILL':
      return baseJob as T & { jobId: string }

    case 'DYNAMODB_CLICKHOUSE_BACKFILL':
      return {
        ...baseJob,
        parameters: {
          entity: 'TRANSACTION' as DynamoDbClickhouseBackfillBatchJobEntity,
          saveToClickhouse: true,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'SYNC_DATABASES':
      return baseJob as T & { jobId: string }

    case 'TEST_FARGATE':
      return {
        ...baseJob,
        parameters: {
          message: 'Test message',
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'TENANT_DELETION':
      return {
        ...baseJob,
        parameters: {
          notRecoverable: false,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'MANUAL_RULE_PRE_AGGREGATION':
      return {
        ...baseJob,
        currentTimestamp: Date.now(),
        ...overrides,
      } as T & { jobId: string }

    case 'FILES_AI_SUMMARY':
      return {
        ...baseJob,
        parameters: {
          commentId: uuidv4(),
          type: 'USER' as const,
          entityId: uuidv4(),
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'ALERT_SLA_STATUS_REFRESH':
      return {
        ...baseJob,
        from: undefined,
        to: undefined,
        ...overrides,
      } as T & { jobId: string }

    case 'REVERIFY_TRANSACTIONS':
      return {
        ...baseJob,
        parameters: {
          afterTimestamp: Date.now() - 86400000, // 24 hours ago
          beforeTimestamp: Date.now(),
          ruleInstanceIds: [uuidv4()],
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'BACKFILL_AVERAGE_TRS':
      return baseJob as T & { jobId: string }

    case 'BACKFILL_ASYNC_RULE_RUNS':
      return {
        ...baseJob,
        parameters: {
          concurrency: 10,
          type: 'RERUN' as const,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'RISK_SCORING_RECALCULATION':
      return {
        ...baseJob,
        parameters: {
          userIds: undefined,
          clearedListIds: undefined,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'PNB_BACKFILL_ENTITIES':
      return {
        ...baseJob,
        parameters: {
          importFileS3Key: 'test-key',
          type: 'TRANSACTION' as const,
          dynamoDbOnly: false,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'PNB_BACKFILL_TRANSACTIONS':
      return {
        ...baseJob,
        parameters: {
          cursor: { type: 'START_TIMESTAMP' as const, value: Date.now() },
          concurrency: 10,
          publicApiEndpoint: 'https://api.example.com',
          publicApiKey: 'test-key',
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'PNB_BACKFILL_KRS':
      return {
        ...baseJob,
        parameters: {
          concurrency: 10,
          publicApiEndpoint: 'https://api.example.com',
          publicApiKey: 'test-key',
          cursor: { type: 'START_TIMESTAMP' as const, value: Date.now() },
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'PNB_BACKFILL_ARS':
      return {
        ...baseJob,
        parameters: {
          cursor: { type: 'START_TIMESTAMP' as const, value: Date.now() },
          concurrency: 10,
          publicApiEndpoint: 'https://api.example.com',
          publicApiKey: 'test-key',
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'PNB_BACKFILL_CRA':
      return {
        ...baseJob,
        parameters: {
          concurrency: 10,
          startTimestamp: undefined,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'PNB_BACKFILL_HAMMERHEAD':
      return {
        ...baseJob,
        parameters: {
          type: 'TRANSACTION' as const,
          concurrency: 10,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'CASE_SLA_STATUS_REFRESH':
      return baseJob as T & { jobId: string }

    case 'PNB_BACKFILL_WEBHOOK_DELIVERIES':
      return {
        ...baseJob,
        parameters: {
          s3Key: 'test-key',
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'FIX_RISK_SCORES_FOR_PNB_USERS':
      return {
        ...baseJob,
        parameters: {
          concurrency: 10,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'WEBHOOK_RETRY':
      return baseJob as T & { jobId: string }

    case 'NANGO_DATA_FETCH':
      return {
        ...baseJob,
        parameters: {
          webhookData: {} as NangoWebhookEvent,
          region: 'us-east-1',
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'FINCEN_REPORT_STATUS_REFRESH':
      return baseJob as T & { jobId: string }

    case 'AGGREGATION_CLEANUP':
      return baseJob as T & { jobId: string }

    case 'PNB_TRANSACTION_UPDATES':
      return {
        ...baseJob,
        parameters: {
          apiKey: 'test-key',
          publicApiEndpoint: 'https://api.example.com',
          concurrency: 10,
          s3Key: 'test-key',
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'IN_HOUSE_SCREENING_MIGRATION':
      return {
        ...baseJob,
        parameters: {
          providers: [],
          settings: [],
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'SYNC_AUTH0_DATA':
      return {
        ...baseJob,
        parameters: { type: 'ALL' as const },
        ...overrides,
      } as T & { jobId: string }

    case 'FAILING_BATCH_JOB':
      return baseJob as T & { jobId: string }

    case 'FIX_LOCKS_FOR_KRS':
      return baseJob as T & { jobId: string }

    case 'FIX_ARS_BREAKDOWN':
      return baseJob as T & { jobId: string }

    case 'CLICKHOUSE_DATA_BACKFILL':
      return {
        ...baseJob,
        parameters: {
          referenceId: uuidv4(),
          tableNames: [],
          type: { type: 'ALL' as const },
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'DELTA_SANCTIONS_DATA_FETCH':
      return {
        ...baseJob,
        providers: [],
        parameters: {
          from: undefined,
          ongoingScreeningTenantIds: undefined,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'BACKFILL_ACTION_PROCESSING':
      return baseJob as T & { jobId: string }

    case 'QA_CLEANUP':
      return baseJob as T & { jobId: string }

    case 'PNB_PULL_USERS_DATA':
      return baseJob as T & { jobId: string }

    case 'MANUAL_TRANSACTION_REVERIFICATION':
      return {
        ...baseJob,
        parameters: {
          uniqId: uuidv4(),
          concurrency: 10,
          mongoBatchSize: 100,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'USER_RULE_RE_RUN':
      return {
        ...baseJob,
        parameters: {
          ruleInstanceIds: [uuidv4()],
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'FLAT_FILES_VALIDATION':
      return {
        ...baseJob,
        parameters: {
          s3Key: 'test-key',
          schema: {} as FlatFileSchema,
          format: 'CSV' as FlatFileTemplateFormat,
          metadata: undefined,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    case 'FLAT_FILES_RUNNER':
      return {
        ...baseJob,
        parameters: {
          s3Key: 'test-key',
          schema: {} as FlatFileSchema,
          format: 'CSV' as FlatFileTemplateFormat,
          metadata: undefined,
          ...overrides.parameters,
        },
      } as T & { jobId: string }

    default:
      return baseJob as T & { jobId: string }
  }
}
