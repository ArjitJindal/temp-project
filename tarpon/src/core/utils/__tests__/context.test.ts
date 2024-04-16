import { getContext, publishMetric, withContext } from '@/core/utils/context'

describe('Publish metric', () => {
  test('added to context for new namespace', async () => {
    await withContext(async () => {
      publishMetric(
        { name: 'Thingy', namespace: 'Flagright', kind: 'GAUGE' },
        100,
        {
          table: 'TopSecret',
        }
      )
      expect(getContext()?.metrics).toHaveProperty('Flagright')
      expect(getContext()?.metrics?.['Flagright']).toHaveLength(1)
    })
  })

  test('added to context for existing namespace', async () => {
    await withContext(
      async () => {
        publishMetric(
          { name: 'Thingy', namespace: 'Flagright', kind: 'GAUGE' },
          100,
          {
            table: 'TopSecret',
          }
        )
        publishMetric(
          { name: 'Thingy', namespace: 'Flagright', kind: 'GAUGE' },
          50,
          {
            table: 'TopSecret',
          }
        )
        expect(getContext()?.metrics?.['Flagright']).toHaveLength(2)
      },
      {
        metrics: { Flagright: [] },
      }
    )
  })
})
