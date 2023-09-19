import { Context, getContextStorage } from '../utils/context'

export const genericContextProvider =
  () =>
  (handler: CallableFunction): any =>
  async (event: any, context: any, callback: any): Promise<any> => {
    return getContextStorage().run({} as Context, async () => {
      return handler(event, context, callback)
    })
  }
