import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TimeseriesQuestion } from '@/services/copilot/questions/types'
import {
  dates,
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/databricks'

export const TrsScore: TimeseriesQuestion<Period> = {
  type: 'TIME_SERIES',
  questionId: COPILOT_QUESTIONS.TRS_SCORE,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `TRS score distribution ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ userId }, period) => {
    const result = await executeSql<{ date: string; avg: number }>(
      `
      select
        date_format(DATE(
          FROM_UNIXTIME(CAST(t.timestamp / 1000 AS BIGINT))
        ), 'yyyy-MM-dd') as date,
        avg(ar.arsScore) as avg
      from
        transactions t
        join action_risk_values ar on ar.transactionId = t.transactionId
      where
        (t.originUserId = :userId or t.destinationUserId = :userId)
        and t.timestamp between :from and :to
      group by
        date
      order by
        date asc
    `,
      {
        userId,
        ...sqlPeriod(period),
      }
    )

    const avgMap = new Map(result.map((item) => [item.date, item.avg]))

    return {
      data: [
        {
          label: '',
          values: dates(period).map((d) => {
            return {
              time: new Date(d).valueOf(),
              value: avgMap.get(d) || 0,
            }
          }),
        },
      ],
      summary: ``,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
