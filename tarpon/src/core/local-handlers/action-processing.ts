import { ActionProcessingRecord } from '@/services/cases/utils'
import { envIs } from '@/utils/env'

export const actionProcessingHandler = async (
  tasks: ActionProcessingRecord[]
) => {
  const { actionProcessingHandler } = await import(
    '@/lambdas/action-processing/app'
  )
  if (envIs('local') || process.env.__ACTION_PROCESSING_ENABLED__ === 'true') {
    await actionProcessingHandler({
      Records: tasks.map((task: ActionProcessingRecord) => ({
        body: JSON.stringify(task),
      })),
    })
  }
  return
}
