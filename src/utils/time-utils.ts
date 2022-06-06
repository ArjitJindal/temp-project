export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function measure<T>(body: () => Promise<T>): Promise<[T, number]> {
  const a = performance.now();
  const result = await body();
  const b = performance.now();
  return [result, b - a];
}
