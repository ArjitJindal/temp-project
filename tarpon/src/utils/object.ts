import crypto from 'crypto'
import _ from 'lodash'
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
  return _.merge(object, ...objects)
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
  return _.pick(
    entity,
    modelClass.getAttributeTypeMap().map((v) => v.name)
  ) as T
}
