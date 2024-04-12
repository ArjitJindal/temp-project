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

export function traverse(
  obj: any,
  visitor: (key: string, value: any, path: string[]) => void,
  path: string[] = []
) {
  if (obj == null || typeof obj !== 'object') {
    return
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => traverse(v, visitor, [...path, i.toString()]))
    return
  }
  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = [...path, key]
    visitor(key, value, currentPath)
    traverse(value, visitor, currentPath)
  })
}

export function getAllValuesByKey<V>(key: string, obj: object): V[] {
  const values: V[] = []
  traverse(obj, (k, v) => {
    if (k === key) {
      values.push(v)
    }
  })
  return values
}
