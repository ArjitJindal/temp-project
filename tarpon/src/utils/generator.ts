export async function* staticValueGenerator<T>(data: T): AsyncGenerator<T> {
  yield data
}

export async function* zipGenerators<T1, T2>(
  generator1: AsyncGenerator<T1>,
  generator2: AsyncGenerator<T2>,
  defaultEmptyData: any = undefined
): AsyncGenerator<[T1, T2]> {
  while (true) {
    let returnResult1 = defaultEmptyData as T1
    const result1 = await generator1.next()
    if (!result1.done) {
      returnResult1 = result1.value as T1
    }
    let returnResult2 = defaultEmptyData as T2
    const result2 = await generator2.next()
    if (!result2.done) {
      returnResult2 = result2.value as T2
    }

    if (result1.done && result2.done) {
      return [defaultEmptyData, defaultEmptyData]
    }

    yield [returnResult1, returnResult2]
  }
}
