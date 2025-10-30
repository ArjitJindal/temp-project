import { executeClickhouseQuery } from './execute'
import { ClickhouseBatchOptions } from '@/@types/clickhouse'

export async function processClickhouseInBatch<
  T extends { timestamp: number; id: string | number }
>(
  tableName: string,
  processBatch: (batch: T[]) => Promise<void>,
  options: ClickhouseBatchOptions
): Promise<void> {
  const clickhouseBatchSize = options?.clickhouseBatchSize ?? 1000
  const processBatchSize = options?.processBatchSize ?? clickhouseBatchSize
  const debug = options?.debug ?? false
  const additionalWhere = options?.additionalWhere
  const additionalSelect = options?.additionalSelect
    ?.map((s) => `${s.expr} AS ${s.name}`)
    .join(', ')
  const additionalJoin = options?.additionalJoin
  let lastCursor = options?.initialCursor
  let batchNumber = 0
  let totalProcessed = 0
  let flag = true

  while (flag) {
    const whereClauses: string[] = []

    // build cursor filter
    if (lastCursor?.timestamp && lastCursor?.id) {
      whereClauses.push(
        `(timestamp, id) > (${lastCursor.timestamp}, '${lastCursor.id}')`
      )
    }

    // append additional filtering if provided
    if (additionalWhere) {
      whereClauses.push(`(${additionalWhere})`)
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const query = `
      SELECT ${additionalSelect ? `${additionalSelect},` : ''} id, timestamp
      FROM ${tableName} FINAL
      ${
        additionalJoin
          ? `${
              Array.isArray(additionalJoin)
                ? additionalJoin.map((j) => `ARRAY JOIN ${j}`).join('\n')
                : `ARRAY JOIN ${additionalJoin}`
            }`
          : ''
      }
      ${whereClause}
      ORDER BY timestamp, id
      LIMIT ${clickhouseBatchSize}
    `
    console.log('query', query)

    const clickhouseBatch = await executeClickhouseQuery<
      { id: string; timestamp: number }[]
    >(options.clickhouseClient, query)

    if (!clickhouseBatch || clickhouseBatch.length === 0) {
      flag = false
      break
    }

    for (let i = 0; i < clickhouseBatch.length; i += processBatchSize) {
      const slice = clickhouseBatch.slice(i, i + processBatchSize)
      await processBatch(
        slice.map((item) => {
          const additionalFields = options.additionalSelect
            ? options.additionalSelect.reduce((acc, s) => {
                acc[s.name] = item[s.name]
                return acc
              }, {} as Record<string, any>)
            : {}

          return {
            ...additionalFields,
          }
        }) as T[]
      )
      batchNumber++
      totalProcessed += slice.length

      if (debug) {
        console.warn(
          `Processed batch #${batchNumber}, processed ${totalProcessed} records`
        )
      }
    }
    const lastItem = clickhouseBatch.at(-1)
    if (lastItem) {
      lastCursor = {
        timestamp: lastItem.timestamp,
        id: lastItem.id,
      }
    } else {
      flag = false
    }
  }

  if (debug) {
    console.warn(
      `Completed processing. Total batches: ${batchNumber}, total records: ${totalProcessed}`
    )
  }
}
