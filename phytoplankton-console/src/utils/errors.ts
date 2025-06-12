/**
 * Custom error class for 404 Not Found errors
 */
export class NotFoundError extends Error {
  constructor(message: string = 'Page not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Utility function to trigger a 404 error that will be caught by ErrorBoundary
 * and render the 404 page component.
 *
 * @param message Optional custom message for the 404 error
 *
 * @example
 * // Basic usage
 * notFound();
 *
 * @example
 * // With custom message
 * notFound('Case not found');
 *
 * @example
 * // In API error handling
 * try {
 *   const data = await api.getData();
 * } catch (error) {
 *   if (error.message.includes('404') || error.message.includes('not found')) {
 *     notFound('Resource not found');
 *   }
 *   throw error; // Re-throw other errors
 * }
 */
export function notFound(message?: string): never {
  throw new NotFoundError(message);
}
