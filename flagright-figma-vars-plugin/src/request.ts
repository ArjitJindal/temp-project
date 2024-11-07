export class RequestError extends Error {
  public readonly statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}

export class Request {
  private baseUrl: string
  private headers: { [name: string]: string }

  constructor(
    baseUrl: string,
    params: {
      headers: { [name: string]: string }
    }
  ) {
    this.baseUrl = baseUrl
    this.headers = params.headers
  }

  async fetch<T>(
    method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
    headers?: { [name: string]: string }
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: method,
      headers: { ...this.headers, ...headers },
      body: JSON.stringify(body),
    })
    if (response.status >= 400) {
      const details = await response.text()
      throw new RequestError(
        `Error while communicating with the server. Code: (${
          response.status
        }), body: ${details}`,
        response.status
      )
    }
    return await response.json()
  }
}
