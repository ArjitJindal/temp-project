import {
  getContext,
  getContextStorage,
  publishMetric,
} from '@/core/utils/context'

describe('Publish metric', () => {
  test('added to context for new namespace', async () => {
    await getContextStorage().run({}, async () => {
      publishMetric({ name: 'Thingy', namespace: 'Flagright' }, 100, {
        table: 'TopSecret',
      })
      expect(getContext()?.metrics).toHaveProperty('Flagright')
      expect(getContext()?.metrics!['Flagright']).toHaveLength(1)
    })
  })

  test('added to context for existing namespace', async () => {
    await getContextStorage().run(
      {
        metrics: { Flagright: [] },
      },
      async () => {
        publishMetric({ name: 'Thingy', namespace: 'Flagright' }, 100, {
          table: 'TopSecret',
        })
        publishMetric({ name: 'Thingy', namespace: 'Flagright' }, 50, {
          table: 'TopSecret',
        })
        expect(getContext()?.metrics!['Flagright']).toHaveLength(2)
      }
    )
  })
})
