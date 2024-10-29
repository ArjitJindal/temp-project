import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  humanReadablePeriod,
  Period,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import {
  paginatedClickhouseQuery,
  paginatedSqlQuery,
} from '@/services/copilot/questions/definitions/common/pagination'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { getContext, hasFeature } from '@/core/utils/context'

export const ReferenceWordCount: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.REFERENCES_WORD_COUNT,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Word used in reference for transactions ${humanReadablePeriod(
      vars
    )}`
  },
  aggregationPipeline: async (
    { userId, username },
    { page, pageSize, ...period }
  ) => {
    let data: { word: string; count: number }[] = []
    let count = 0
    if (hasFeature('CLICKHOUSE_ENABLED')) {
      const client = await getClickhouseClient(getContext()?.tenantId as string)
      const { rows, total } = await paginatedClickhouseQuery<{
        word: string
        count: number
      }>(
        client,
        `SELECT
          lower(word) AS word,
          count(*) AS count
      FROM (
          SELECT
              id,
              reference,
              word
          FROM transactions FINAL
          ARRAY JOIN splitByString(' ', reference) AS word
          WHERE (originUserId = :userId or destinationUserId = :userId)
          ${period ? `AND timestamp between :from and :to` : ''}
      ) AS words
      WHERE length(word) > 1
          GROUP BY word
          ORDER BY count DESC`,
        {
          userId,
          ...sqlPeriod(period),
        },
        page,
        pageSize
      )

      data = rows
      count = total
    } else {
      const { rows, total } = await paginatedSqlQuery<{
        word: string
        count: number
      }>(
        `
    select
      lower(word) as word,
      count(*) as count
    from
      (
        select
          transactionId,
          reference,
          word
        from
          transactions
      cross join unnest(split(reference, ' ')) AS t (word)
      where 
   originUserId = :userId or destinationUserId = :userId
      ) words
    where
      length(word) > 1
    group by
      word
    order by
      count desc
    `,
        {
          userId,
          ...sqlPeriod(period),
        },
        page,
        pageSize
      )

      data = rows
      count = total
    }

    return {
      data: {
        items: data.map((r) => [r.word, r.count]),
        total: count,
      },
      summary: data.length
        ? `The top word used by ${username} in their transaction references was ${
            data.at(0)?.word
          }, appearing ${data.at(0)?.count} times.`
        : ``,
    }
  },
  headers: [
    { name: 'Word', columnType: 'STRING' },
    { name: 'Count', columnType: 'NUMBER' },
  ],
  variableOptions: periodVars,
  defaults: () => {
    return {}
  },
}
