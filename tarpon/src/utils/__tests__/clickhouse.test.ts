import {
  getClickhouseClient,
  getClickhouseDbName,
  batchInsertToClickhouse,
} from '../clickhouse/utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { logger } from '@/core/logger'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

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
  describe('Testing batch insert', () => {
    withFeatureHook(['CLICKHOUSE_ENABLED'])
    let tenantId: string
    let client: any

    beforeEach(async () => {
      tenantId = getTestTenantId()
      client = await getClickhouseClient(tenantId)

      // Create test table for batch insert tests
      await client.query({
        query: `
          CREATE TABLE IF NOT EXISTS users
          (
              id String,
              data String,
              timestamp UInt64,
              is_deleted UInt8 DEFAULT 0
          )
          ENGINE = MergeTree()
          ORDER BY id
        `,
        format: 'JSONEachRow',
      })
    })

    afterEach(async () => {
      // Clean up test table
      await client.query({
        query: 'DROP TABLE IF EXISTS users',
        format: 'JSONEachRow',
      })
    })

    test('Should succeed on first attempt without retries', async () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation()

      const originalInsert = client.insert.bind(client)
      const mockInsert = jest.fn().mockImplementation(originalInsert)
      client.insert = mockInsert

      const testObjects = [
        { id: 'success1', name: 'Success Test', timestamp: Date.now() },
      ]

      await batchInsertToClickhouse(tenantId, 'users', testObjects)

      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(loggerWarnSpy).not.toHaveBeenCalled()

      loggerWarnSpy.mockRestore()
    })

    test('Should succeed after some failed retry attempts', async () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation()

      let attemptCount = 0
      const maxFailures = 3

      const originalInsert = client.insert.bind(client)
      const mockInsert = jest.fn().mockImplementation(async (params) => {
        attemptCount++

        if (attemptCount <= maxFailures) {
          throw new Error(
            `Temporary ClickHouse failure (attempt ${attemptCount})`
          )
        }

        return originalInsert(params)
      })

      client.insert = mockInsert

      const testObjects = [
        { id: 'retry1', name: 'Retry Test', timestamp: Date.now() },
      ]

      await batchInsertToClickhouse(tenantId, 'users', testObjects)

      expect(mockInsert).toHaveBeenCalledTimes(maxFailures + 1)
      expect(loggerWarnSpy).toHaveBeenCalledTimes(maxFailures)

      loggerWarnSpy.mockRestore()
    })
  })
})
