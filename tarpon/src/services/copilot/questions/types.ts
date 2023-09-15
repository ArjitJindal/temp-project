type ColumnType = 'STRING' | 'DATETIME' // ...

type Variables = {
  [key: string]: string | number | undefined
}

export type VariableOptions<V> = {
  [K in keyof V]: 'TIMESTAMP' | 'NUMBER' | 'STRING' | 'INTEGER'
}

export type Question<V extends Variables, D> = {
  questionId: string
  title?: (variables: V) => string
  aggregationPipeline: (
    context: {
      tenantId: string
      caseId: string
      alertId: string
      userId: string
    },
    variables: V
  ) => Promise<D>
  variableOptions: VariableOptions<V>
  defaults?: () => V
}

export type TableQuestion<V extends Variables> = {
  type: 'TABLE'
  headers: { name: string; columnType: ColumnType }[]
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
