import crypto from 'crypto'
import { pick, merge, mergeWith, isNil, isArray, uniqWith } from 'lodash'
import { stringify } from 'safe-stable-stringify'

export function generateChecksum(obj: any, length = 64) {
  const hash = crypto.createHash('sha256')
  hash.update(stringify(obj) ?? '')
  return hash.digest('hex').slice(0, length)
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

export const dedupObjectArray = <T extends object>(array: T[]): T[] => {
  const isEqual = (a: T, b: T) => {
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((key) => a[key] === b[key])
    )
  }

  return uniqWith(array, isEqual)
}
