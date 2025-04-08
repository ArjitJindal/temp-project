import { getContext } from '@/core/utils/context-storage'

let processInBackground = false

export const initBackground = () => {
  processInBackground = true
}
export const disableBackground = () => {
  processInBackground = false
}

export const background = async (...tasks: Promise<unknown>[]) => {
  const ctx = getContext()
  if (!processInBackground || !ctx) {
    return await Promise.all(tasks)
  }
  if (ctx) {
    ctx.promises = ctx?.promises ? [...ctx.promises].concat(tasks) : tasks // eslint-disable-line @typescript-eslint/no-floating-promises
  }
}

export const waitForTasks = async () => {
  const ctx = getContext()
  if (ctx && ctx.promises) {
    await Promise.all(ctx?.promises)
  }
}
