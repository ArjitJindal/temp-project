export const replaceMagicKeyword = <T>(
  input: any,
  keyword: string,
  replacement: string
) =>
  JSON.parse(
    JSON.stringify(input).replace(
      new RegExp(keyword, 'g'),
      replacement.replace(/\$/g, '$$$$')
    )
  ) as T

export function getAllValuesByKey<V>(key: string, obj: object): V[] {
  const values: V[] = []
  const traverse = (o: any) => {
    if (o == null || typeof o !== 'object') {
      return
    }
    if (Array.isArray(o)) {
      o.forEach(traverse)
      return
    }
    if (o[key]) {
      values.push(o[key])
      return
    }
    Object.values(o).forEach(traverse)
  }
  traverse(obj)
  return values
}
