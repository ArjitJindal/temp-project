import { envIs } from '@/utils/env'

export async function handleLocalAsyncRuleTasks(
  tasks: any[],
  saveBatchEntities: boolean
) {
  const { asyncRuleRunnerHandler } = await import('@/lambdas/async-rule/app')
  if (envIs('local') || process.env.__ASYNC_RULES_IN_SYNC_TEST__ === 'true') {
    await asyncRuleRunnerHandler({
      Records: tasks.map((task) => ({
        body: JSON.stringify(task),
      })),
      saveBatchEntities,
    })
  }
  return
}
