import { ApiUsageMetricsService } from '../api-usage-metrics-service'
import { getApiUsageMetricsService } from './utils'
import { Metric } from '@/@types/cloudwatch'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import dayjs from '@/utils/dayjs'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'

dynamoDbSetupHook()

withFeaturesToggled([], ['CLICKHOUSE_ENABLED', 'CLICKHOUSE_MIGRATION'], () => {
  describe('ApiUsageMetricsService', () => {
    const tenantId = getTestTenantId()
    const mockTenant = {
      id: tenantId,
      name: 'flagright-test',
    }
    let service: ApiUsageMetricsService
    beforeEach(async () => {
      service = await getApiUsageMetricsService(tenantId)
    })

    describe('getDailyMetricValues', () => {
      it('should return daily metric values for a given time range', async () => {
        const timeRange = {
          startTimestamp: dayjs().subtract(1, 'day').valueOf(),
          endTimestamp: dayjs().valueOf(),
        }
        const result = await service.getDailyMetricValues(mockTenant, timeRange)

        expect(Array.isArray(result)).toBe(true)
        result.forEach((entry) => {
          expect(entry).toHaveProperty('date')
          expect(entry).toHaveProperty('values')
          expect(Array.isArray(entry.values)).toBe(true)
        })
      })
    })

    describe('getMonthlyMetricValues', () => {
      it('should aggregate daily metrics into monthly values', async () => {
        const mockMetric: Metric = {
          name: 'test_metric',
          kind: 'GAUGE',
          namespace: 'TestNamespace',
        }

        const dailyMetrics = [
          {
            date: '2024-03-01',
            values: [{ metric: mockMetric, value: 10 }],
          },
          {
            date: '2024-03-02',
            values: [{ metric: mockMetric, value: 20 }],
          },
        ]

        const result = service.getMonthlyMetricValues(dailyMetrics)

        expect(Array.isArray(result)).toBe(true)
        expect(result[0]).toHaveProperty('month', '2024-03')
        expect(result[0].values[0].value).toBe(20)
      })
    })
  })
})
