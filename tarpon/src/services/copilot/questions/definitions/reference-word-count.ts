import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  humanReadablePeriod,
  Period,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { paginatedSqlQuery } from '@/services/copilot/questions/definitions/common/pagination'

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

    return {
      data: {
        items: rows.map((r) => [r.word, r.count]),
        total,
      },
      summary: `The top word used by ${username} in their transaction references was ${
        rows.at(0)?.word
      }, appearing ${rows.at(0)?.count} times.`,
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
