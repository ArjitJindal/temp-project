import crypto from 'crypto'
import {
  pick,
  merge,
  mergeWith,
  isNil,
  isArray,
  uniqBy,
  isPlainObject,
  transform,
  isUndefined,
} from 'lodash'
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

export const uniqObjects = <T extends object>(array: T[]): T[] => {
  return uniqBy(array, generateChecksum)
}

export function removeUndefinedFields<T>(obj: T): T {
  if (isArray(obj)) {
    // If the object is an array, iterate over the elements
    return obj.map(removeUndefinedFields) as T
  } else if (isPlainObject(obj)) {
    // If the object is a plain object, iterate over its properties
    return transform(obj as object, (result, value, key) => {
      const cleanedValue = removeUndefinedFields(value)
      if (!isUndefined(cleanedValue) && cleanedValue !== null) {
        result[key] = cleanedValue
      }
    })
  } else {
    // If it's not an object or array, return the value directly
    return obj
  }
}

export function getSortedObject(obj: object) {
  const keys = Object.keys(obj).sort()
  const sortedObject = keys.reduce((acc, key) => {
    acc[key] = obj[key]
    return acc
  }, {})
  return removeUndefinedFields(sortedObject)
}

export function removeEmptyKeys<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  for (const key in obj) {
    if (key === '') {
      delete obj[key]
    } else if (typeof obj[key] === 'object') {
      removeEmptyKeys(obj[key])
    }
  }
  return obj
}
