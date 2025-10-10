import { AsyncLocalStorage } from 'async_hooks'
import type { Context } from './context'

const asyncLocalStorage = new AsyncLocalStorage<Context>()

export function getContextStorage() {
  return asyncLocalStorage
}

export function getContext(): Context | undefined {
  return asyncLocalStorage.getStore()
}
