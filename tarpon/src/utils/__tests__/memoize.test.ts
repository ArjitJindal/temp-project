import memoize from 'lodash/memoize'
import { memoizePromise } from '../memoize'

describe('memoizePromise', () => {
  it('should cache successful promises', async () => {
    let callCount = 0
    const fn = async (_x: number) => {
      callCount++
      return 4
    }

    const memoized = memoizePromise(fn)

    const result1 = await memoized(2)
    const result2 = await memoized(2)

    expect(result1).toBe(4)
    expect(result2).toBe(4)
    expect(callCount).toBe(1)
  })

  it('should not cache failed promises', async () => {
    let callCount = 0
    const fn = async (_x: number) => {
      callCount++
      throw new Error('Test error')
    }

    const memoized = memoizePromise(fn)

    await expect(memoized(2)).rejects.toThrow('Test error')
    await expect(memoized(2)).rejects.toThrow('Test error')

    expect(callCount).toBe(2)
  })

  it('should handle different arguments separately', async () => {
    let callCount = 0
    const fn = async (x: number) => {
      callCount++
      return x * 2
    }

    const memoized = memoizePromise(fn)

    const result1 = await memoized(2)
    const result2 = await memoized(3)

    expect(result1).toBe(4)
    expect(result2).toBe(6)
    expect(callCount).toBe(2)
  })

  it('should handle complex arguments', async () => {
    let callCount = 0
    const fn = async (obj: { x: number; y: string }) => {
      callCount++
      return `${obj.y}${obj.x}`
    }

    const memoized = memoizePromise(fn)

    const result1 = await memoized({ x: 1, y: 'test' })
    const result2 = await memoized({ x: 1, y: 'test' })

    expect(result1).toBe('test1')
    expect(result2).toBe('test1')
    expect(callCount).toBe(1)
  })

  it('should handle multiple arguments', async () => {
    let callCount = 0
    const fn = async (x: number, y: string) => {
      callCount++
      return `${y}${x}`
    }

    const memoized = memoizePromise(fn)

    const result1 = await memoized(1, 'test')
    const result2 = await memoized(1, 'test')

    expect(result1).toBe('test1')
    expect(result2).toBe('test1')
    expect(callCount).toBe(1)
  })
})

describe('memoizePromise vs Lodash memoize', () => {
  it('should handle promise rejections differently', async () => {
    let lodashCallCount = 0
    let ourCallCount = 0

    // Lodash memoize will cache the rejected promise
    const lodashFn = memoize(async (_x: number) => {
      lodashCallCount++
      throw new Error('Test error')
    })

    // Our memoizePromise will not cache rejected promises
    const ourFn = memoizePromise(async (_x: number) => {
      ourCallCount++
      throw new Error('Test error')
    })

    // Test both functions
    await expect(lodashFn(1)).rejects.toThrow('Test error')
    await expect(lodashFn(1)).rejects.toThrow('Test error')
    expect(lodashCallCount).toBe(1) // Lodash caches the rejected promise

    await expect(ourFn(1)).rejects.toThrow('Test error')
    await expect(ourFn(1)).rejects.toThrow('Test error')
    expect(ourCallCount).toBe(2) // Our version retries on rejection
  })

  it('should handle concurrent calls correctly', async () => {
    let callCount = 0
    const slowFn = async (x: number) => {
      callCount++
      await new Promise((resolve) => setTimeout(resolve, 100))
      return x * 2
    }

    const lodashMemoized = memoize(slowFn)
    const ourMemoized = memoizePromise(slowFn)

    // Test both functions with concurrent calls
    callCount = 0
    const lodashResults = await Promise.all([
      lodashMemoized(1),
      lodashMemoized(1),
    ])
    expect(lodashResults[0]).toBe(2)
    expect(lodashResults[1]).toBe(2)
    expect(callCount).toBe(1) // Only one call for both versions

    callCount = 0
    const ourResults = await Promise.all([ourMemoized(1), ourMemoized(1)])
    expect(ourResults[0]).toBe(2)
    expect(ourResults[1]).toBe(2)
    expect(callCount).toBe(1)
  })

  it('should handle promise resolution timing', async () => {
    let resolveTime1: number
    let resolveTime2: number

    const fn = async (x: number) => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return x * 2
    }

    const lodashMemoized = memoize(fn)
    const ourMemoized = memoizePromise(fn)

    // Test Lodash memoize
    const start1 = Date.now()
    await lodashMemoized(1)
    resolveTime1 = Date.now() - start1

    const start2 = Date.now()
    await lodashMemoized(1)
    resolveTime2 = Date.now() - start2

    // Lodash might have some overhead in promise handling
    expect(resolveTime2).toBeLessThan(resolveTime1)

    // Test our memoizePromise
    const start3 = Date.now()
    await ourMemoized(1)
    resolveTime1 = Date.now() - start3

    const start4 = Date.now()
    await ourMemoized(1)
    resolveTime2 = Date.now() - start4

    // Our version should be faster on subsequent calls
    expect(resolveTime2).toBeLessThan(resolveTime1)
  })

  it('should handle promise rejection and retry', async () => {
    let attempts = 0
    const fn = async (x: number) => {
      attempts++
      if (attempts === 1) {
        throw new Error('First attempt fails')
      }
      return x * 2
    }

    const lodashMemoized = memoize(fn)
    const ourMemoized = memoizePromise(fn)

    // Lodash will keep returning the same rejected promise
    await expect(lodashMemoized(1)).rejects.toThrow('First attempt fails')
    await expect(lodashMemoized(1)).rejects.toThrow('First attempt fails')
    expect(attempts).toBe(1) // Only one attempt

    // Reset attempts
    attempts = 0

    // Our version will retry on rejection
    await expect(ourMemoized(1)).rejects.toThrow('First attempt fails')
    const result = await ourMemoized(1)
    expect(result).toBe(2)
    expect(attempts).toBe(2) // Two attempts
  })
})
