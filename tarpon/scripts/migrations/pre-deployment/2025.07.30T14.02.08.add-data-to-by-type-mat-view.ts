import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import {
  getClickhouseClient,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'

async function migrateTenant(tenant: Tenant) {
  const clickhouseClient = await getClickhouseClient(tenant.id)

  console.log(`Starting materialized view backfill for tenant: ${tenant.id}`)

  try {
    //Create Null table for transactions_by_type backfill
    console.log('Creating Null table for transactions_by_type backfill...')
    await clickhouseClient.exec({
      query: `
        CREATE TABLE IF NOT EXISTS transactions_by_type_backfill_null
        (
          id String,
          type String,
          timestamp UInt64,
          negative_timestamp Int64
        )
        ENGINE = Null
      `,
    })

    //Create Null table for transactions_by_type_daily backfill
    console.log(
      'Creating Null table for transactions_by_type_daily backfill...'
    )
    await clickhouseClient.exec({
      query: `
        CREATE TABLE IF NOT EXISTS transactions_by_type_daily_backfill_null
        (
          day Date,
          type String,
          unique_transactions AggregateFunction(uniq, String)
        )
        ENGINE = Null
      `,
    })

    // Create materialized views pointing to Null tables
    console.log('Creating backfill materialized views...')

    // MV for simple transactions_by_type
    await clickhouseClient.exec({
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS transactions_by_type_backfill_mv_null 
        TO transactions_by_type
        AS SELECT
          id,
          type,
          timestamp,
          -1*timestamp as negative_timestamp
        FROM transactions_by_type_backfill_null
      `,
    })

    // MV for daily aggregated transactions_by_type_daily
    await clickhouseClient.exec({
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS transactions_by_type_daily_backfill_mv_null
        TO transactions_by_type_daily
        AS SELECT
          day,
          type,
          unique_transactions
        FROM transactions_by_type_daily_backfill_null
      `,
    })

    // Get the date range for backfill (avoid processing too much data at once)
    console.log('Determining backfill date range...')
    const dateRange = await executeClickhouseQuery<
      { min_date: string; max_date: string }[]
    >(clickhouseClient, {
      query: `
        SELECT 
          toDate(toDateTime(min(timestamp) / 1000)) as min_date,
          toDate(toDateTime(max(timestamp) / 1000)) as max_date
        FROM transactions 
        WHERE timestamp != 0 AND updateCount = 1
      `,
      format: 'JSONEachRow',
    })

    if (dateRange.length === 0) {
      console.log('No data found to backfill')
      return
    }

    const { min_date, max_date } = dateRange[0]
    console.log(`Backfill date range: ${min_date} to ${max_date}`)

    // Backfill transactions_by_type (simple one first)
    console.log('Backfilling transactions_by_type...')
    await clickhouseClient.exec({
      query: `
        INSERT INTO transactions_by_type_backfill_null 
        SELECT 
          id,
          type,
          timestamp,
          -1*timestamp as negative_timestamp
        FROM transactions 
        WHERE timestamp != 0
      `,
    })

    // Backfill transactions_by_type_daily (aggregated one)
    console.log('Backfilling transactions_by_type_daily...')
    await clickhouseClient.exec({
      query: `
        INSERT INTO transactions_by_type_daily_backfill_null
        SELECT 
          toDate(toDateTime(timestamp / 1000)) as day,
          type,
          uniqState(id) as unique_transactions
        FROM transactions 
        WHERE timestamp != 0
        GROUP BY day, type
      `,
    })

    // Verify the backfill worked
    console.log('Verifying backfill results...')

    const verifyByType = await executeClickhouseQuery<{ count: number }[]>(
      clickhouseClient,
      {
        query: `SELECT COUNT(*) as count FROM transactions_by_type`,
        format: 'JSONEachRow',
      }
    )

    const verifyDaily = await executeClickhouseQuery<{ count: number }[]>(
      clickhouseClient,
      {
        query: `SELECT COUNT(*) as count FROM transactions_by_type_daily`,
        format: 'JSONEachRow',
      }
    )

    console.log(`Backfill verification:`)
    console.log(`- transactions_by_type: ${verifyByType[0]?.count || 0} rows`)
    console.log(
      `- transactions_by_type_daily: ${verifyDaily[0]?.count || 0} rows`
    )

    // Step 8: Clean up Null tables and temporary MVs
    console.log('Cleaning up temporary backfill objects...')

    await clickhouseClient.exec({
      query: `DROP VIEW IF EXISTS transactions_by_type_backfill_mv_null`,
    })

    await clickhouseClient.exec({
      query: `DROP VIEW IF EXISTS transactions_by_type_daily_backfill_mv_null`,
    })

    await clickhouseClient.exec({
      query: `DROP TABLE IF EXISTS transactions_by_type_backfill_null`,
    })

    await clickhouseClient.exec({
      query: `DROP TABLE IF EXISTS transactions_by_type_daily_backfill_null`,
    })

    console.log(
      `Successfully backfilled materialized views for tenant: ${tenant.id}`
    )
  } catch (error) {
    console.error(
      `Failed to backfill materialized views for tenant: ${tenant.id}`,
      error
    )

    // Clean up on error
    try {
      await clickhouseClient.exec({
        query: `DROP VIEW IF EXISTS transactions_by_type_backfill_mv_null`,
      })
      await clickhouseClient.exec({
        query: `DROP VIEW IF EXISTS transactions_by_type_daily_backfill_mv_null`,
      })
      await clickhouseClient.exec({
        query: `DROP TABLE IF EXISTS transactions_by_type_backfill_null`,
      })
      await clickhouseClient.exec({
        query: `DROP TABLE IF EXISTS transactions_by_type_daily_backfill_null`,
      })
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError)
    }

    throw error
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {}
