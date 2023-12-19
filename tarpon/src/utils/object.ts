import crypto from 'crypto'
import { pick, merge, mergeWith, isNil, isArray, uniqWith } from 'lodash'
import { stringify } from 'safe-stable-stringify'

export const replaceMagicKeyword = (
  input: any,
  keyword: string,
  replacement: string
) =>
  JSON.parse(
    JSON.stringify(input).replace(
      new RegExp(keyword, 'g'),
      replacement.replace(/\$/g, '$$$$')
    )
  )

export function generateChecksum(obj: any) {
  const hash = crypto.createHash('sha256')
  hash.update(stringify(obj) ?? '')
  return hash.digest('hex')
}

type NotPromiseType<T> = T extends Promise<any> ? never : T

export function mergeObjects<T>(
  object: NotPromiseType<T>,
  ...objects: Array<NotPromiseType<T>>
): NotPromiseType<T> {
  return merge(object, ...objects)
}

export function mergeEntities<T>(object: T, src: object, deep = true): T {
  return mergeWith(object, src, (a: any, b: any) => {
    if (!isNil(b) && isArray(b)) {
      return b
    }
    if (deep) {
      return undefined
    }
    return b
  })
}

class Model {
  public static getAttributeTypeMap(): Array<{
    name: string
    baseName: string
    type: string
    format: string
  }> {
    return []
  }
}

export function pickKnownEntityFields<T>(
  entity: T,
  modelClass: typeof Model
): T {
  return pick(
    entity,
    modelClass.getAttributeTypeMap().map((v) => v.name)
  ) as T
}

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

export const dedupObjectArray = <T extends object>(array: T[]): T[] => {
  const isEqual = (a: T, b: T) => {
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((key) => a[key] === b[key])
    )
  }

  return uniqWith(array, isEqual)
}

export const deleteUnwantedKeys = (
  obj: any,
  keys: readonly string[] = [],
  maxDepth: number = 2,
  depth = 0
) => {
  if (!keys.length || maxDepth <= 0 || typeof obj !== 'object' || obj == null) {
    return
  }

  if (depth >= maxDepth) {
    return
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => deleteUnwantedKeys(item, keys, maxDepth, depth + 1))
  } else if (typeof obj === 'object' && obj !== null) {
    keys.forEach((key) => delete obj[key])
    Object.values(obj).forEach((value) =>
      deleteUnwantedKeys(value, keys, maxDepth, depth + 1)
    )
  }
}
