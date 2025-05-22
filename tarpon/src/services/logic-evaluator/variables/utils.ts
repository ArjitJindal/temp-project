import {
  concat,
  findLastIndex,
  groupBy,
  lowerCase,
  snakeCase,
  startCase,
} from 'lodash'
import {
  COUNTRIES,
  COUNTRY_GROUP_LABELS,
  CURRENCIES,
} from '@flagright/lib/constants'
import { isValidAcronyms } from '@flagright/lib/constants/acronyms'
import * as Models from '@/@types/openapi-public/all'
import * as CustomModelData from '@/@types/openapi-public-custom/all'
import { EntityModel } from '@/@types/model'

export type LeafValueType = 'string' | 'number' | 'boolean'
const LEAF_VALUE_TYPES: LeafValueType[] = ['string', 'number', 'boolean']
export type EntityLeafValueInfo = {
  path: string[]
  pathKey: string
  type: LeafValueType
  options?: Array<{ title: string; value: string }>
}
export const ARRAY_ITEM_INDICATOR = '$i'
function getPathKey(path: string[]) {
  return path.join('.')
}

function getOptions(
  enumConstKey: string,
  optionValues: string[]
): Array<{ title: string; value: string }> {
  if (enumConstKey === 'CURRENCY_CODES') {
    return CURRENCIES.map((v) => ({
      title: v.label,
      value: v.value,
    }))
  }
  if (enumConstKey === 'COUNTRY_CODES') {
    return getCountriesOptions()
  }

  return optionValues.map((value) => ({
    title: isValidAcronyms(value) ? value : startCase(lowerCase(value)),
    value,
  }))
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
    const attributeType = attribute.type

    if (LEAF_VALUE_TYPES.includes(attributeType as LeafValueType)) {
      // Handle leaf value types directly
      result.push({
        path,
        pathKey: getPathKey(path),
        type: attributeType as LeafValueType,
      })
    } else if (
      attributeType.includes(' | ') &&
      !attributeType.includes('Array')
    ) {
      // Handle oneOf types
      const oneOfResult = attributeType
        .split(' | ')
        .flatMap((type) => getPublicModelLeafAttrsByName(type, path))
      mergeResultsByPathKey(oneOfResult, result)
    } else if (attributeType.startsWith('Array<')) {
      // Handle arrays
      const arrayType = attributeType.match(/Array<(.+)>/)?.[1]
      if (arrayType) {
        const arrayPath = [...path, ARRAY_ITEM_INDICATOR]
        if (LEAF_VALUE_TYPES.includes(arrayType as LeafValueType)) {
          result.push({
            path: arrayPath,
            pathKey: getPathKey(arrayPath),
            type: arrayType as LeafValueType,
          })
        } else {
          handleArrayTypes(arrayType, arrayPath, result)
        }
      }
    } else {
      // Handle custom models and enums
      const leafInfos = getPublicModelLeafAttrsByName(attributeType, path)
      if (leafInfos.length > 0) {
        result.push(...leafInfos)
      } else {
        handleEnumTypes(attributeType, path, result)
      }
    }
  }

  return result
}

export function isArrayIntermediateNode(info: EntityLeafValueInfo) {
  const index = info.path.indexOf(ARRAY_ITEM_INDICATOR)
  return index !== -1 && index !== info.path.length - 1
}
export function isArrayLeafNode(info: EntityLeafValueInfo) {
  return info.path.indexOf(ARRAY_ITEM_INDICATOR) === info.path.length - 1
}

export function isArrayIntermediateNodeandHasLeafArrayNode(
  info: EntityLeafValueInfo
) {
  const index = info.path.indexOf(ARRAY_ITEM_INDICATOR)
  const reverseIndex = findLastIndex(
    info.path,
    (v) => v === ARRAY_ITEM_INDICATOR
  )
  return (
    index !== -1 &&
    index !== info.path.length - 1 &&
    reverseIndex === info.path.length - 1
  )
}

function handleArrayTypes(
  arrayType: string,
  arrayPath: string[],
  result: EntityLeafValueInfo[]
) {
  if (!arrayType.includes(' | ')) {
    const arrayModel = Models[arrayType]
    if (arrayModel) {
      result.push(...getPublicModelLeafAttrs(arrayModel, arrayPath))
    } else {
      handleEnumTypes(arrayType, arrayPath, result)
    }
  } else {
    const oneOfResult = arrayType.split(' | ').flatMap((type) => {
      const arrayModel = Models[type]
      return arrayModel ? getPublicModelLeafAttrs(arrayModel, arrayPath) : []
    })
    mergeResultsByPathKey(oneOfResult, result)
  }
}

function handleEnumTypes(
  attributeType: string,
  path: string[],
  result: EntityLeafValueInfo[]
) {
  const enumConstKey = `${snakeCase(attributeType).toUpperCase()}S`
  const enumValues = CustomModelData[enumConstKey] as string[]
  if (enumValues) {
    result.push({
      path,
      pathKey: getPathKey(path),
      type: 'string',
      options: getOptions(enumConstKey, enumValues),
    })
  }
}

function mergeResultsByPathKey(
  source: EntityLeafValueInfo[],
  target: EntityLeafValueInfo[]
) {
  const groups = groupBy(source, 'pathKey')
  for (const groupKey in groups) {
    const options = groups[groupKey].flatMap((v) => v.options ?? [])
    target.push({
      path: groups[groupKey][0].path,
      pathKey: groups[groupKey][0].pathKey,
      type: groups[groupKey][0].type,
      options: options.length > 0 ? options : undefined,
    })
  }
}

export function getCountriesOptions(): Array<{ title: string; value: string }> {
  return concat(
    Object.entries(COUNTRIES).map((entry) => ({
      title: `${entry[1]} (${entry[0]})`,
      value: entry[0],
    })),
    Object.entries(COUNTRY_GROUP_LABELS).map((entry) => ({
      title: `${entry[1]} (${entry[0]})`,
      value: entry[0],
    }))
  )
}
