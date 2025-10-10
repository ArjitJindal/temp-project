// https://basarat.gitbooks.io/typescript/docs/types/never.html
export function neverThrow(obj: never, message?: string): never {
  throw new Error(message ?? 'Should never happen')
}

export function neverReturn<T>(obj: never, defaultValue: T): T {
  return defaultValue
}

export function getErrorMessage(e: unknown) {
  if (e instanceof Error && e.message) {
    return e.message
  }
  return 'Unknown error'
}

export type Undefined<T> = {
  [K in keyof T]?: T[K]
}
