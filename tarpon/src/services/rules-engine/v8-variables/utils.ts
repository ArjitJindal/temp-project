import { groupBy, lowerCase, snakeCase, startCase } from 'lodash'
import * as Models from '@/@types/openapi-public/all'
import * as CustomModelData from '@/@types/openapi-public-custom/all'
export abstract class EntityModel {
  static readonly attributeTypeMap: Array<{
    name: string
    baseName: string
    type: string
    format: string
  }>
}
export type LeafValueType = 'string' | 'number' | 'boolean'
const LEAF_VALUE_TYPES: LeafValueType[] = ['string', 'number', 'boolean']
export type EntityLeafValueInfo = {
  path: string[]
  pathKey: string
  type: LeafValueType
  options?: Array<{ title: string; value: string }>
}
const ARRAY_ITEM_INDICATOR = '$i'
function getPathKey(path: string[]) {
  return path.join('.')
}

function getPublicModelLeafAttrsByName(
  modelName: string,
  parentPath: string[] = []
): EntityLeafValueInfo[] {
  const model = Models[modelName]
  if (model) {
    return getPublicModelLeafAttrs(model, parentPath)
  }
  return []
}

export function getPublicModelLeafAttrs(
  entityClass: typeof EntityModel,
  parentPath: string[] = []
): EntityLeafValueInfo[] {
  const result: EntityLeafValueInfo[] = []
  for (const attribute of entityClass.attributeTypeMap) {
    const path = [...parentPath, attribute.baseName]
    if (LEAF_VALUE_TYPES.includes(attribute.type as LeafValueType)) {
      result.push({
        path,
        pathKey: getPathKey(path),
        type: attribute.type as LeafValueType,
      })
    } else if (attribute.type.includes(' | ')) {
      // oneOf
      const oneOfResult: EntityLeafValueInfo[] = []
      for (const type of attribute.type.split(' | ')) {
        oneOfResult.push(...getPublicModelLeafAttrsByName(type, path))
      }
      // Merge objects with the same 'pathKey'
      const groups = groupBy(oneOfResult, 'pathKey')
      for (const groupKey in groups) {
        const options = groups[groupKey].flatMap((v) => v.options ?? [])
        result.push({
          path: groups[groupKey][0].path,
          pathKey: groups[groupKey][0].pathKey,
          type: groups[groupKey][0].type,
          options: options.length > 0 ? options : undefined,
        })
      }
    } else {
      // Custom model
      if (attribute.type.startsWith('Array<')) {
        const arrayType = attribute.type.match(/Array<(.+)>/)?.[1]
        if (arrayType) {
          const arrayPath = [...path, ARRAY_ITEM_INDICATOR]
          if (LEAF_VALUE_TYPES.includes(arrayType as LeafValueType)) {
            result.push({
              path: arrayPath,
              pathKey: getPathKey(arrayPath),
              type: arrayType as LeafValueType,
            })
          } else {
            const arrayModel = Models[arrayType]
            if (arrayModel) {
              result.push(...getPublicModelLeafAttrs(arrayModel, arrayPath))
            }
          }
        }
      } else {
        const leafInfos = getPublicModelLeafAttrsByName(attribute.type, path)
        if (leafInfos.length > 0) {
          result.push(...leafInfos)
        } else {
          // Enum
          const enumValues = CustomModelData[
            `${snakeCase(attribute.type).toUpperCase()}S`
          ] as string[]
          if (enumValues) {
            result.push({
              path,
              pathKey: getPathKey(path),
              type: 'string',
              options: enumValues.map((value) => ({
                title: startCase(lowerCase(value)),
                value,
              })),
            })
          }
        }
      }
    }
  }
  return result
}
