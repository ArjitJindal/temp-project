import { NodeClickHouseClient as ClickHouseClient } from '@clickhouse/client/dist/client'
import { ClickhouseTableNames } from './table-names'

export type IndexOptions = {
  type: string
  config: Record<string, any>
}

export type IndexType =
  | 'inverted'
  | 'normal'
  | 'bloom_filter'
  | 'minmax'
  | 'set'
  | 'tokenbf_v1'

type BaseTableDefinition = {
  table: ClickhouseTableNames
  idColumn: string
  timestampColumn: string
  columns?: string[]
  database?: string
  materializedColumns?: string[]
  indexes?: {
    column: string
    name: string
    type: IndexType
    options: {
      granularity: number
      ngramSize?: number
      bloomFilterSize?: number
      bloomFilterIndex?: number
      numHashFunctions?: number
      randomSeed?: number
      setSize?: number
    }
  }[]
  engine:
    | 'ReplacingMergeTree'
    | 'AggregatingMergeTree'
    | 'SummingMergeTree'
    | 'MergeTree'
  versionColumn?: string
  primaryKey: string
  orderBy: string
  partitionBy?: string
  mongoIdColumn?: boolean
  optimize?: boolean
}

type QueryCallback = (tenantId: string) => Promise<string>

export type MaterializedViewDefinition = Omit<
  BaseTableDefinition,
  'idColumn' | 'timestampColumn' | 'projections' | 'materializedColumns'
> & {
  viewName: string
  columns: string[]
  query?: string | QueryCallback
  refresh?: {
    interval: number
    granularity: 'MINUTE' | 'HOUR' | 'DAY' | 'SECOND'
  }
}

export type ProjectionsDefinition = {
  name: string
  version: number
  definition: {
    columns: string[]
    aggregator: 'GROUP'
    aggregatorBy: string
  }
}

export type ClickhouseTableDefinition = BaseTableDefinition & {
  materializedViews?: MaterializedViewDefinition[]
  projections?: ProjectionsDefinition[]
  model?: string // Optional: Generate columns from this model instead of materializedColumns
}
export type ClickhouseBatchOptions = {
  clickhouseBatchSize?: number
  processBatchSize?: number
  debug?: boolean
  initialCursor?: { timestamp: number; id: string | number }
  additionalWhere?: string
  additionalSelect?: { name: string; expr: string }[]
  additionalJoin?: string
  clickhouseClient: ClickHouseClient
}
