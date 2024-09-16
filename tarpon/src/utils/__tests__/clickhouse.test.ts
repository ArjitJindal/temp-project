import { getClickhouseClient, getClickhouseDbName } from '../clickhouse/utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

describe('Clickhouse', () => {
  it('should be able to connect to Clickhouse', async () => {
    const tenantId = getTestTenantId()
    const client = await getClickhouseClient(tenantId)

    const result = await client.query({
      query: 'SHOW DATABASES',
      format: 'JSONEachRow',
    })

    const data = await result.json<{ name: string }>()
    const databaseExists = data.some(
      (db) => db.name === getClickhouseDbName(tenantId)
    )

    expect(databaseExists).toBe(true)
  })

  test('Should Replace Rows in ReplacingMergeTree - single orderby', async () => {
    const tenantId = getTestTenantId()
    const client = await getClickhouseClient(tenantId)

    await client.query({
      query: `
            CREATE TABLE IF NOT EXISTS test_table
            (
                id UInt32 PRIMARY KEY,
                data String,
                timestamp DateTime,
                is_deleted UInt8 DEFAULT 0
            )
            ENGINE = ReplacingMergeTree() 
            ORDER BY id
        `,
      format: 'JSONEachRow',
    })

    await client.insert({
      table: 'test_table',
      values: [
        {
          id: 1,
          data: 'test',
          timestamp: '2021-10-10 10:10:10',
          is_deleted: 0,
        },
        {
          id: 2,
          data: 'test2',
          timestamp: '2021-10-10 10:10:20',
          is_deleted: 0,
        },
      ],
      columns: ['id', 'data', 'timestamp'],
      format: 'JSON',
    })

    const result = await client.query({
      query: 'SELECT * FROM test_table FINAL',
      format: 'JSONEachRow',
    })

    const data = await result.json()

    expect(data).toEqual([
      {
        id: 1,
        data: 'test',
        timestamp: '2021-10-10 10:10:10',
        is_deleted: 0,
      },
      {
        id: 2,
        data: 'test2',
        timestamp: '2021-10-10 10:10:20',
        is_deleted: 0,
      },
    ])

    await client.insert({
      table: 'test_table',
      values: [
        {
          id: 1,
          data: 'test3',
          timestamp: '2021-10-10 10:10:10',
          is_deleted: 0,
        },
        {
          id: 2,
          data: 'test4',
          timestamp: '2021-10-10 10:10:40',
          is_deleted: 0,
        },
      ],
      columns: ['id', 'data', 'timestamp'],
      format: 'JSON',
    })

    const result2 = await client.query({
      query: 'SELECT * FROM test_table FINAL',
      format: 'JSONEachRow',
    })

    expect(await result2.json()).toEqual([
      {
        id: 1,
        data: 'test3',
        timestamp: '2021-10-10 10:10:10',
        is_deleted: 0,
      },
      {
        id: 2,
        data: 'test4',
        timestamp: '2021-10-10 10:10:40',
        is_deleted: 0,
      },
    ])

    await client.query({
      query: 'DROP TABLE test_table',
      format: 'JSONEachRow',
    })
  })

  test('Should Replace Rows in ReplacingMergeTree - multiple orderby', async () => {
    const tenantId = getTestTenantId()
    const client = await getClickhouseClient(tenantId)

    await client.query({
      query: `
            CREATE TABLE IF NOT EXISTS test_table
            (
                id UInt32 PRIMARY KEY,
                data String,
                timestamp DateTime,
                is_deleted UInt8 DEFAULT 0
            )
            ENGINE = ReplacingMergeTree() 
            ORDER BY (id, timestamp)
        `,
      format: 'JSONEachRow',
    })

    await client.insert({
      table: 'test_table',
      values: [
        {
          id: 1,
          data: 'test',
          timestamp: '2021-10-10 10:10:10',
          is_deleted: 0,
        },
        {
          id: 2,
          data: 'test2',
          timestamp: '2021-10-10 10:10:20',
        },
      ],
      columns: ['id', 'data', 'timestamp'],
      format: 'JSON',
    })

    const result = await client.query({
      query: 'SELECT * FROM test_table FINAL',
      format: 'JSONEachRow',
    })

    const data = await result.json()

    expect(data).toEqual([
      {
        id: 1,
        data: 'test',
        timestamp: '2021-10-10 10:10:10',
        is_deleted: 0,
      },
      {
        id: 2,
        data: 'test2',
        timestamp: '2021-10-10 10:10:20',
        is_deleted: 0,
      },
    ])

    await client.insert({
      table: 'test_table',
      values: [
        {
          id: 1,
          data: 'test3',
          timestamp: '2021-10-10 10:10:10',
          is_deleted: 0,
        },
        {
          id: 2,
          data: 'test4',
          timestamp: '2021-10-10 10:10:40',
          is_deleted: 0,
        },
      ],
      columns: ['id', 'data', 'timestamp'],
      format: 'JSON',
    })

    const result2 = await client.query({
      query: 'SELECT * FROM test_table FINAL',
      format: 'JSONEachRow',
    })

    expect(await result2.json()).toEqual([
      {
        id: 2,
        data: 'test2',
        timestamp: '2021-10-10 10:10:20',
        is_deleted: 0,
      },
      {
        id: 1,
        data: 'test3',
        timestamp: '2021-10-10 10:10:10',
        is_deleted: 0,
      },

      {
        id: 2,
        data: 'test4',
        timestamp: '2021-10-10 10:10:40',
        is_deleted: 0,
      },
    ])
  })
})
