import { ClickhouseSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import {
  bulkInsertToClickhouse,
  createTenantDatabase,
  executeClickhouseQuery,
  getClickhouseClient,
} from '@/utils/clickhouse/utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils' // Adjust the path

withFeatureHook(['CLICKHOUSE_ENABLED'])

describe('ClickhouseSanctionsRepository', () => {
  beforeAll(async () => {
    await createTenantDatabase('flagright')
    await bulkInsertToClickhouse(
      'sanctions_data',
      [
        {
          provider: 'dowjones',
          version: '24-08',
          id: '1',
          name: 'Tim',
          createdAt: Date.now(),
        },
        {
          provider: 'dowjones',
          version: '24-08',
          id: '2',
          name: 'Bob',
          createdAt: Date.now(),
        },
        {
          provider: 'dowjones',
          version: '24-08',
          id: '3',
          name: 'Sam',
          createdAt: Date.now(),
        },
      ],
      'flagright'
    )
  })

  afterAll(async () => {
    const client = await getClickhouseClient('flagright')
    await client.command({
      query: 'truncate table sanctions_data',
    })
  })

  it('should update associates field with correct names', async () => {
    const associates: [string, { id: string; association: string }[]][] = [
      ['1', [{ id: '2', association: '2' }]],
      [
        '2',
        [
          { id: '3', association: '3' },
          { id: '1', association: '1' },
        ],
      ],
    ]

    const repo = new ClickhouseSanctionsRepository()
    await repo.saveAssociations('dowjones', associates, '24-08')

    const objects = await executeClickhouseQuery<{ data: string }>(
      'flagright',
      'select data from sanctions_data',
      {}
    )
    const result = objects.map((o) => JSON.parse(o.data))
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '1',
          name: 'Tim',
          associates: expect.arrayContaining([
            expect.objectContaining({ name: 'Bob' }),
          ]),
        }),
        expect.objectContaining({
          id: '2',
          name: 'Bob',
          associates: expect.arrayContaining([
            expect.objectContaining({ name: 'Tim' }),
            expect.objectContaining({ name: 'Sam' }),
          ]),
        }),
        expect.objectContaining({
          id: '3',
          name: 'Sam',
        }),
      ])
    )
  })

  it('should handle empty associate arrays', async () => {
    const associates: [string, { id: string; association: string }[]][] = [
      ['1', []],
      ['2', []],
    ]

    const repo = new ClickhouseSanctionsRepository()
    await repo.saveAssociations('dowjones', associates, '24-08')

    const objects = await executeClickhouseQuery<{ data: string }>(
      'flagright',
      'select data from sanctions_data',
      {}
    )
    const result = objects.map((o) => JSON.parse(o.data))

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '1', name: 'Tim', associates: [] }),
        expect.objectContaining({ id: '2', name: 'Bob', associates: [] }),
        expect.objectContaining({ id: '3', name: 'Sam' }),
      ])
    )
  })

  it('should not modify documents without associates', async () => {
    const associates: [string, { id: string; association: string }[]][] = [
      ['1', [{ id: '2', association: '2' }]],
    ]

    const repo = new ClickhouseSanctionsRepository()
    await repo.saveAssociations('dowjones', associates, '24-08')

    const objects = await executeClickhouseQuery<{ data: string }>(
      'flagright',
      `select data from sanctions_data where id = '3'`,
      {}
    )
    const result = objects.map((o) => JSON.parse(o.data))[0]

    expect(result).toEqual(
      expect.objectContaining({
        id: '3',
        name: 'Sam',
      })
    )
  })

  it('should not fail if there are no associates to update', async () => {
    const associates: [string, { id: string; association: string }[]][] = []

    const repo = new ClickhouseSanctionsRepository()
    await repo.saveAssociations('dowjones', associates, '24-08')

    const objects = await executeClickhouseQuery<{ data: string }>(
      'flagright',
      `select data from sanctions_data`,
      {}
    )
    const result = objects.map((o) => JSON.parse(o.data))
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '1', name: 'Tim' }),
        expect.objectContaining({ id: '2', name: 'Bob' }),
        expect.objectContaining({ id: '3', name: 'Sam' }),
      ])
    )
  })
})
