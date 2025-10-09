import {
  UiSchemaNumberSlider,
  UiSchemaParams,
  UiSchemaParamsAgeRange,
} from '@/services/rules-engine/utils/rule-schema-utils'
import {
  TimeWindowGranularity,
  TimeWindowFiscalYear,
} from '@/services/rules-engine/utils/time-utils'

export type SchemaOptions = {
  title?: string
  description?: string
  uiSchema?: UiSchemaParams<unknown>
}

export type TimeWindow = {
  units: number
  granularity: TimeWindowGranularity
  rollingBasis?: boolean
  fiscalYear?: TimeWindowFiscalYear
}

export type TransactionsCounterPartiesThreshold = {
  transactionsCounterPartiesCount: number
  checkPaymentMethodDetails?: boolean
}

export type DayWindow = {
  units: number
  granularity: 'day'
  rollingBasis?: boolean
}

export type AgeRangeSchemaOptions = SchemaOptions & {
  uiSchema?: Partial<UiSchemaParamsAgeRange>
}

export type NumberSliderSchemaOptions = SchemaOptions & {
  uiSchema?: Partial<UiSchemaNumberSlider>
}
export type TransactionAmountRange = {
  [currency: string]: {
    max?: number
    min?: number
  }
}

export interface TimeRangeHourAndMinute {
  utcHours: number
  utcMinutes: number
}

export interface TransactionTimeRange {
  startTime: TimeRangeHourAndMinute
  endTime: TimeRangeHourAndMinute
}
export type Comparator = 'GREATER_THAN_OR_EQUAL_TO' | 'LESS_THAN_OR_EQUAL_TO'

export type ValueComparator = {
  value: number
  comparator: Comparator
}
