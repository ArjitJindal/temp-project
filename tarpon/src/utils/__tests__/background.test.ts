import {
  background,
  disableBackground,
  initBackground,
  waitForTasks,
} from '@/utils/background'
import { withContext } from '@/core/utils/context'
describe('Background promises', () => {
  test('Promise is completed in the background', async () => {
    let i = 0
    await withContext(async () => {
      initBackground()
      const waitOneSecond = new Promise<void>((resolve) => {
        setTimeout(() => {
          i++
          resolve()
        }, 100)
      })
      await background(waitOneSecond)
      await waitForTasks()
    })
    expect(i).toEqual(1)
  })
  test('Promise is completed when background not initialised', async () => {
    disableBackground()
    let i = 0
    await withContext(async () => {
      const waitOneSecond = new Promise<void>((resolve) => {
        setTimeout(() => {
          i++
          resolve()
        }, 100)
      })
      await background(waitOneSecond)
    })
    expect(i).toEqual(1)
  })
  test('Promise is completed even with no context', async () => {
    let i = 0
    initBackground()
    const waitOneSecond = new Promise<void>((resolve) => {
      setTimeout(() => {
        i++
        resolve()
      }, 100)
    })
    await background(waitOneSecond)
    expect(i).toEqual(1)
  })
})
