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
        type: QuestionVariableOptionVariableTypeEnum
        options?: (ctx: InvestigationContext) => Promise<string[]> | string[]
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

export type Question<V extends Variables, D> = {
  questionId: string
  title?: (ctx: InvestigationContext, variables: V) => string
  aggregationPipeline: (
    context: InvestigationContext,
    variables: V
  ) => Promise<{ data: D; summary: string }>
  variableOptions: VariableOptions<V>
  defaults: (ctx: InvestigationContext) => V
}

export type TableQuestion<V extends Variables> = {
  type: 'TABLE'
  headers: { name: string; columnType: TableHeadersColumnTypeEnum }[]
} & Question<V, (string | number | undefined)[][]>

export type TimeseriesQuestion<V extends Variables> = {
  type: 'TIME_SERIES'
} & Question<V, { label: string; values: { time: number; value: number }[] }[]>

export type StackedBarchartQuestion<V extends Variables> = {
  type: 'STACKED_BARCHART'
} & Question<V, { label: string; values: { x: string; y: number }[] }[]>

export type BarchartQuestion<V extends Variables> = {
  type: 'BARCHART'
} & Question<V, { x: string; y: number }[]>

export type PropertiesQuestion<V extends Variables> = {
  type: 'PROPERTIES'
} & Question<V, PropertiesProperties[]>

export type Investigation = {
  alertId: string
  questions: {
    questionId: string
    variables: Variables
    createdAt: number
    createdById: string
  }[]
}
