import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { compact } from 'lodash'
import { COUNTRIES } from '@flagright/lib/constants'
import { humanizeAuto } from '@flagright/lib/utils/humanize'
import { ColumnDefinition, TableQuestion } from '../types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'

const getHitsTableQuestion = (
  filterStatus: SanctionsHitStatus
): TableQuestion<{
  pageSize?: number
  page?: number
}> => {
  const headers: ColumnDefinition[] = [
    { name: 'Hit ID', columnType: 'STRING', width: 100 },
    { name: 'Name', columnType: 'STRING', width: 200 },
    { name: 'Countries', columnType: 'COUNTRY', width: 120 },
    { name: 'Match types', columnType: 'TAG', width: 120 },
    { name: 'Relevance', columnType: 'STRING', width: 120 },
  ]

  if (filterStatus === 'CLEARED') {
    headers.push({ name: 'Clearing reason', columnType: 'STRING', width: 200 })
  }

  headers.push({ name: 'Comments', columnType: 'STRING', width: 650 })
  return {
    type: 'TABLE',
    variableOptions: {},
    defaults: () => ({
      page: 1,
      pageSize: 20,
    }),
    aggregationPipeline: async ({ tenantId, alert }, { page, pageSize }) => {
      const searchIds = compact(
        alert?.ruleHitMeta?.sanctionsDetails?.map((d) => d.searchId)
      )
      if (!searchIds.length) {
        return {
          data: { items: [], total: 0 },
          summary: '',
        }
      }

      const mongoDbClient = await getMongoDbClient()

      const sanctionsHitsRepository = new SanctionsHitsRepository(
        tenantId,
        mongoDbClient
      )

      const clearedHits = await sanctionsHitsRepository.searchHitsOffset({
        filterSearchId: searchIds,
        pageSize,
        page,
        filterStatus: [filterStatus],
      })

      return {
        data: {
          items: clearedHits.items.map((hit) => [
            hit.sanctionsHitId,
            hit.entity.name,
            compact(
              hit.entity.countries?.map((c) => {
                const countryCode = Object.entries(COUNTRIES).find(
                  ([_, v]) => v === c
                )?.[0]
                return countryCode ?? c
              })
            ),
            hit.entity.types,
            compact(hit.entity.matchTypes?.map(humanizeAuto)),
            ...(filterStatus === 'CLEARED'
              ? [hit.clearingReason?.map((r) => humanizeAuto(r))]
              : []),
            hit.comment,
          ]),
          total: clearedHits.total,
        },
        summary: '',
      }
    },
    categories: ['CONSUMER', 'BUSINESS'],
    questionId:
      filterStatus === 'CLEARED'
        ? COPILOT_QUESTIONS.CLEARED_HITS
        : COPILOT_QUESTIONS.OPEN_HITS,
    version: 1,
    headers,
    skipCache: true,
    title: async () => {
      return filterStatus === 'CLEARED' ? 'Cleared hits' : 'Human review'
    },
  }
}

export const ClearedHits: TableQuestion<{
  pageSize?: number
  page?: number
}> = getHitsTableQuestion('CLEARED')

export const OpenHits: TableQuestion<{
  pageSize?: number
  page?: number
}> = getHitsTableQuestion('OPEN')
