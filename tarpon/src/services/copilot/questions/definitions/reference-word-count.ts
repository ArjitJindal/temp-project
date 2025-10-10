import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  humanReadablePeriod,
  Period,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { paginatedClickhouseQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'

type ReferenceWordCountRow = {
  word: string
  count: number
}

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
    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }

    const { rows, total } =
      await paginatedClickhouseQuery<ReferenceWordCountRow>(
        `SELECT
          lower(word) AS word,
          count(*) AS count
      FROM (
          SELECT
              id,
              reference,
              word
          FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
          ARRAY JOIN splitByString(' ', reference) AS word
          WHERE (originUserId = '{{ userId }}' or destinationUserId = '{{ userId }}')
          ${period ? `AND timestamp between {{ from }} and {{ to }}` : ''}
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

    return {
      data: {
        items: rows.map((r) => [r.word, r.count]),
        total,
      },
      summary: rows.length
        ? `The top word used by ${username} in their transaction references was ${
            rows.at(0)?.word
          }, appearing ${rows.at(0)?.count} times.`
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
