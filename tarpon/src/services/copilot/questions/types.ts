import { QuestionId } from '@flagright/lib/utils'
import { QuestionVariableOptionVariableTypeEnum } from '@/@types/openapi-internal/QuestionVariableOption'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
import { TableHeadersColumnTypeEnum } from '@/@types/openapi-internal/TableHeaders'
import { AccountsService } from '@/services/accounts'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { PropertiesProperties } from '@/@types/openapi-internal/PropertiesProperties'
import { PageSize } from '@/utils/pagination'
import { QuestionVariable } from '@/@types/openapi-internal/QuestionVariable'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { LogicEntityVariableInUse } from '@/@types/openapi-internal/LogicEntityVariableInUse'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { RuleType } from '@/@types/openapi-internal/RuleType'
import { RuleMachineLearningVariable } from '@/@types/openapi-internal/RuleMachineLearningVariable'
export type Variables = {
  [key: string]: (typeof QuestionVariable.prototype)['value']
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
  user?: InternalConsumerUser | InternalBusinessUser
  username: string
  accountService: AccountsService
  paymentIdentifier?: PaymentDetails
  convert: (amount: number, target: CurrencyCode) => number
  humanReadableId: string
}

export type QuestionCategory = 'BUSINESS' | 'CONSUMER' | 'PAYMENT'

export type QuestionBase<V extends Variables> = {
  questionId: QuestionId
  version?: number
  title?: (ctx: InvestigationContext, variables: V) => Promise<string>
  explainer?: string
  variableOptions: VariableOptions<V>
  defaults: (ctx: InvestigationContext) => V
  categories: QuestionCategory[]
  skipCache?: boolean
}

export type Question<T extends Variables> =
  | TableQuestion<T>
  | StackedBarchartQuestion<T>
  | BarchartQuestion<T>
  | TimeseriesQuestion<T>
  | PropertiesQuestion<T>
  | EmbeddedQuestion<T>
  | ScreeningComparisonQuestion<T>
  | RuleHitQuestion<T>
export type AggregationQuestion<V extends Variables, D> = QuestionBase<V> & {
  aggregationPipeline: (
    context: InvestigationContext,
    variables: V
  ) => Promise<{ data: D; summary: string }>
}

export type ColumnDefinition = {
  name: string
  columnType: TableHeadersColumnTypeEnum
  width?: number
  columnId?: string
  sortable?: boolean
}

export type TableQuestion<V extends Variables> = {
  type: 'TABLE'
  headers: ColumnDefinition[]
} & AggregationQuestion<
  V & { pageSize?: PageSize; page?: number },
  { items: (string | string[] | number | undefined)[][]; total?: number }
>

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
} & QuestionBase<V>

export type ScreeningComparisonQuestion<V extends Variables> = {
  type: 'SCREENING_COMPARISON'
} & QuestionBase<V>
export type RuleHitResponse = {
  hitRulesDetails: HitRulesDetails
  ruleLogic?: any
  ruleSummary?: string
  ruleType?: RuleType
  logicAggregationVariables?: LogicAggregationVariable[]
  logicEntityVariables?: LogicEntityVariableInUse[]
  logicMlVariables?: RuleMachineLearningVariable[]
}
export type RuleHitQuestion<V extends Variables> = {
  type: 'RULE_LOGIC'
} & AggregationQuestion<V, any>

export type Investigation = {
  alertId: string
  questions: {
    questionId: string
    variables: Variables
    createdAt: number
    createdById: string
  }[]
}
