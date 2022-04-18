export function chunk<T>(arr: T[], chunkSize: number): T[][] {
  const res = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize)
    res.push(chunk)
  }
  return res
}

export async function everyAsync<T>(
  arr: T[],
  predicate: (e: T) => Promise<boolean>
) {
  for (const e of arr) {
    if (!(await predicate(e))) {
      return false
    }
  }
  return true
}
