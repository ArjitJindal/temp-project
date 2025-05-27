import pMap from 'p-map'

export interface BatchProcessorOptions<T, R> {
  concurrency: number
  batchSize?: number
  processor: (item: T) => Promise<R> | R
}

async function* processBatch<T, R>(
  batch: T[],
  processor: (item: T) => Promise<R> | R,
  concurrency: number
): AsyncGenerator<R> {
  const results = await pMap(batch, processor, { concurrency })
  for (const result of results) {
    yield result
  }
}

export async function* asyncIterableBatchProcess<T, R>(
  items: AsyncIterable<T>,
  options: BatchProcessorOptions<T, R>
): AsyncGenerator<R> {
  const { concurrency, batchSize = concurrency * 10, processor } = options
  let currentBatch: T[] = []

  for await (const item of items) {
    currentBatch.push(item)

    if (currentBatch.length >= batchSize) {
      yield* processBatch(currentBatch, processor, concurrency)
      currentBatch = []
    }
  }

  // Process remaining items
  if (currentBatch.length > 0) {
    yield* processBatch(currentBatch, processor, concurrency)
  }
}
