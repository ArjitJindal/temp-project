import { CopilotQuestionIds } from '@flagright/lib/utils'
import { QuestionVariableOptionVariableTypeEnum } from '@/@types/openapi-internal/QuestionVariableOption'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
import { TableHeadersColumnTypeEnum } from '@/@types/openapi-internal/TableHeaders'
import { AccountsService } from '@/services/accounts'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { PropertiesProperties } from '@/@types/openapi-internal/PropertiesProperties'

export type Variables = {
  [key: string]: string | number
}

export type VariableOptions<V> = {
  [K in keyof V]:
    | QuestionVariableOptionVariableTypeEnum
    | {
        type: 'AUTOCOMPLETE'
        options: (ctx: InvestigationContext) => Promise<string[]> | string[]
      }
    | {
        type: 'SEARCH'
        search: (
          tenantId: string,
          search: string
        ) => Promise<string[]> | string[]
      }
}

export type InvestigationContext = {
  tenantId: string
  caseId: string
  alertId: string
  userId: string
  alert: Alert
  _case: Case
  user: InternalConsumerUser | InternalBusinessUser
  username: string
  accountService: AccountsService
}

export type QuestionCategory = 'BUSINESS' | 'CONSUMER'

export type Question<V extends Variables> = {
  questionId: CopilotQuestionIds
  title?: (ctx: InvestigationContext, variables: V) => Promise<string>
  explainer?: string
  variableOptions: VariableOptions<V>
  defaults: (ctx: InvestigationContext) => V
  categories: QuestionCategory[]
}

export type AggregationQuestion<V extends Variables, D> = Question<any> & {
  aggregationPipeline: (
    context: InvestigationContext,
    variables: V
  ) => Promise<{ data: D; summary: string }>
}

export type TableQuestion<V extends Variables> = {
  type: 'TABLE'
  headers: { name: string; columnType: TableHeadersColumnTypeEnum }[]
} & AggregationQuestion<V, (string | number | undefined)[][]>

export type TimeseriesQuestion<V extends Variables> = {
  type: 'TIME_SERIES'
} & AggregationQuestion<
  V,
  { label: string; values: { time: number; value: number }[] }[]
>

export type StackedBarchartQuestion<V extends Variables> = {
  type: 'STACKED_BARCHART'
} & AggregationQuestion<
  V,
  { label: string; values: { x: string; y: number }[] }[]
>

export type BarchartQuestion<V extends Variables> = {
  type: 'BARCHART'
} & AggregationQuestion<V, { x: string; y: number }[]>

export type PropertiesQuestion<V extends Variables> = {
  type: 'PROPERTIES'
} & AggregationQuestion<V, PropertiesProperties[]>

export type EmbeddedQuestion<V extends Variables> = {
  type: 'EMBEDDED'
} & Question<V>

export type Investigation = {
  alertId: string
  questions: {
    questionId: string
    variables: Variables
    createdAt: number
    createdById: string
  }[]
}
