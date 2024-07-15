import { AttributeSet } from '@/services/copilot/attributes/builder'
import { AutoNarrativeService } from '@/services/copilot/auto-narrative-service'
import { withContext } from '@/core/utils/context'

describe('Auto narrative service tests', () => {
  test('Correct ma spelling', async () => {
    await withContext(
      async () => {
        const autoNarrativeService = new AutoNarrativeService()
        const result = await autoNarrativeService.formatNarrative(
          'correct ma spelling',
          new AttributeSet([])
        )
        console.log(result)
      },
      { tenantId: 'test' }
    )
  })
})
