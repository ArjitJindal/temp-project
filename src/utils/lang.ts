// https://basarat.gitbooks.io/typescript/docs/types/never.html
export function neverThrow(obj: never, message?: string): never {
  throw new Error(message ?? 'Should never happen')
}

export function neverReturn<T>(obj: never, defaultValue: T): T {
  return defaultValue
}
