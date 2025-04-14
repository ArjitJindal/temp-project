import { COUNTRIES } from '@flagright/lib/constants'
import { uniqBy } from 'lodash'
import { humanizeSnakeCase } from '@flagright/lib/utils/humanize'
import { CommonUserLogicVariable, LogicVariableContext } from './types'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { ReportRepository } from '@/services/sar/repositories/report-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ReportStatus } from '@/@types/openapi-internal/ReportStatus'
import { REPORT_STATUSS } from '@/@types/openapi-internal-custom/ReportStatus'
import { REPORT_GENERATORS } from '@/services/sar/utils/helper'

const SAR_REGION_OPTIONS = uniqBy(
  Array.from(REPORT_GENERATORS.keys()).map((key) => {
    const country = key.split('-')[0]
    return { title: COUNTRIES[country], value: country }
  }),
  'value'
)

const SAR_STATUS_OPTIONS: { title: string; value: ReportStatus }[] =
  REPORT_STATUSS.map((status) => ({
    value: status,
    title: humanizeSnakeCase(status),
  }))

export const SAR_DETAILS: CommonUserLogicVariable = {
  entity: 'USER',
  key: 'sarDetails',
  valueType: 'array',
  sourceField: 'sarDetails',
  uiDefinition: {
    label: 'SAR details',
    type: '!group',
    mode: 'array',
    conjunctions: ['AND', 'OR'],
    subfields: {
      status: {
        label: 'SAR Status',
        type: 'text',
        fieldSettings: {
          listValues: SAR_STATUS_OPTIONS,
        },
        valueSources: ['value', 'field', 'func'],
      },
      region: {
        label: 'SAR Jurisdiction',
        type: 'text',
        fieldSettings: {
          listValues: SAR_REGION_OPTIONS,
        },
        valueSources: ['value', 'field', 'func'],
      },
      sarId: {
        label: 'SAR ID',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
      },
      createdAt: {
        label: 'SAR Created At',
        type: 'datetime',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  requiredFeatures: ['SAR'],
  load: async (user: User | Business, context?: LogicVariableContext) => {
    if (!context) {
      throw new Error('Missing context')
    }
    const mongoDb = await getMongoDbClient()
    const reportRepository = new ReportRepository(
      context.tenantId,
      mongoDb,
      context.dynamoDb
    )
    const data = await reportRepository.getReportsDataForUserFromDynamo(
      user.userId
    )
    return data
  },
}
