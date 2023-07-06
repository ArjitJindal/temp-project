import { getContext } from '@/core/utils/context'

const GLOBAL_KEY = 'global'
const tasksByRequestId: Map<string, Promise<unknown>[]> = new Map()
let processInBackground = false

export const initBackground = () => {
  processInBackground = false
}

export const background = async (...tasks: Promise<unknown>[]) => {
  if (!processInBackground) {
    return await Promise.all(tasks)
  }
  const ctx = getContext()
  let key = GLOBAL_KEY
  if (ctx && ctx.requestId) {
    key = ctx.requestId
  }
  const updatedTasks = tasksByRequestId.get(key) || []
  updatedTasks.push(...tasks)
  tasksByRequestId.set(key, updatedTasks)
}

export const waitForTasks = async () => {
  const ctx = getContext()
  let key = GLOBAL_KEY
  if (ctx && ctx.requestId) {
    key = ctx.requestId
  }
  try {
    await Promise.all(tasksByRequestId.get(key) || [])
  } finally {
    if (ctx && ctx.requestId) {
      tasksByRequestId.delete(ctx.requestId)
    }
  }
}
