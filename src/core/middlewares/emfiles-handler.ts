// eslint-disable-next-line @typescript-eslint/no-var-requires
const lambda_emfiles = require('@samwen/lambda-emfiles')

export const emfilesHandler =
  () =>
  (handler: CallableFunction): CallableFunction =>
  async (event: unknown, context: unknown): Promise<unknown> => {
    try {
      if (process.env.ENV !== 'local') {
        await lambda_emfiles.start_verify()
      }
      return handler(event, context)
    } finally {
      if (process.env.ENV !== 'local') {
        await lambda_emfiles.final_check()
      }
    }
  }
