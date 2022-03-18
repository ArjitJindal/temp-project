import * as createError from 'http-errors'

export const httpErrorHandler =
  () =>
  (handler: CallableFunction): CallableFunction =>
  async (event: unknown, context: unknown): Promise<unknown> => {
    try {
      return await handler(event, context)
    } catch (error) {
      if (error instanceof createError.HttpError && error.statusCode < 500) {
        return {
          body: JSON.stringify({
            error: error.name,
            message: error.message,
            stack:
              process.env.ENV === 'local' || process.env.ENV === 'dev'
                ? error.stack
                : undefined,
          }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          statusCode: error.statusCode,
        }
      }
      console.error(error)
      return {
        body: JSON.stringify({
          error: 'Internal server error',
          message: (error as createError.HttpError)?.message,
          stack:
            process.env.ENV === 'local' || process.env.ENV === 'dev'
              ? (error as createError.HttpError)?.stack
              : undefined,
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        statusCode: 500,
      }
    }
  }
