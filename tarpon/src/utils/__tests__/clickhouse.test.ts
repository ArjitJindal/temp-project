import { getClickhouseClient } from '../clickhouse-utils'

describe('Clickhouse', () => {
  it('should be able to connect to Clickhouse', async () => {
    const client = await getClickhouseClient()

    const result = await client.query({
      query: 'SHOW DATABASES',
      format: 'JSONEachRow',
    })

    const data = await result.json()
    expect(data).toContainEqual({ name: 'tarpon_test' })
  })

  test('Should Replace Rows in ReplacingMergeTree - single orderby', async () => {
    const client = await getClickhouseClient()

    await client.query({
      query: `
            CREATE TABLE IF NOT EXISTS test_table
            (
                id UInt32 PRIMARY KEY,
                data String,
                timestamp DateTime 
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
      },
      {
        id: 2,
        data: 'test2',
        timestamp: '2021-10-10 10:10:20',
      },
    ])

    await client.insert({
      table: 'test_table',
      values: [
        {
          id: 1,
          data: 'test3',
          timestamp: '2021-10-10 10:10:10',
        },
        {
          id: 2,
          data: 'test4',
          timestamp: '2021-10-10 10:10:40',
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
      },
      {
        id: 2,
        data: 'test4',
        timestamp: '2021-10-10 10:10:40',
      },
    ])

    await client.query({
      query: 'DROP TABLE test_table',
      format: 'JSONEachRow',
    })
  })

  test('Should Replace Rows in ReplacingMergeTree - multiple orderby', async () => {
    const client = await getClickhouseClient()

    await client.query({
      query: `
            CREATE TABLE IF NOT EXISTS test_table
            (
                id UInt32 PRIMARY KEY,
                data String,
                timestamp DateTime
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
      },
      {
        id: 2,
        data: 'test2',
        timestamp: '2021-10-10 10:10:20',
      },
    ])

    await client.insert({
      table: 'test_table',
      values: [
        {
          id: 1,
          data: 'test3',
          timestamp: '2021-10-10 10:10:10',
        },
        {
          id: 2,
          data: 'test4',
          timestamp: '2021-10-10 10:10:40',
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
      },
      {
        id: 1,
        data: 'test3',
        timestamp: '2021-10-10 10:10:10',
      },

      {
        id: 2,
        data: 'test4',
        timestamp: '2021-10-10 10:10:40',
      },
    ])
  })
})
