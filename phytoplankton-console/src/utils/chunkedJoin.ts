const CHUNK_SIZE = 1000;
/**
 * Safely joins large arrays by processing them in chunks
 * @param array - Array to join
 * @param separator - Separator string
 * @returns Joined string with all data preserved
 */
export function chunkedJoin<T>(array: T[] | undefined | null, separator: string = ', '): string {
  if (!array || array.length === 0) {
    return '';
  }

  if (array.length <= CHUNK_SIZE) {
    return array.join(separator);
  }

  const chunks: string[] = [];
  for (let i = 0; i < array.length; i += CHUNK_SIZE) {
    const chunk = array.slice(i, i + CHUNK_SIZE);
    chunks.push(chunk.join(separator));
  }

  return chunks.join(separator);
}
