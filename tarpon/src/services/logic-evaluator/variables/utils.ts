import concat from 'lodash/concat'
import findLastIndex from 'lodash/findLastIndex'
import groupBy from 'lodash/groupBy'
import lowerCase from 'lodash/lowerCase'
import snakeCase from 'lodash/snakeCase'
import startCase from 'lodash/startCase'
import {
  COUNTRIES,
  COUNTRY_GROUP_LABELS,
  CURRENCIES,
} from '@flagright/lib/constants'
import { isValidAcronyms } from '@flagright/lib/constants/acronyms'
import { humanizeAuto } from '@flagright/lib/utils/humanize'
import * as Models from '@/@types/openapi-public/all'
import * as CustomModelData from '@/@types/openapi-public-custom/all'
import { EntityModel } from '@/@types/model'
import { notEmpty } from '@/utils/array'

export type LeafValueType = 'string' | 'number' | 'boolean'
const LEAF_VALUE_TYPES: LeafValueType[] = ['string', 'number', 'boolean']

type PathElementKey = { key: string; oneOfSubtype?: string }
type PathElementArray = { isArray: true }
type PathElement = PathElementKey | PathElementArray

export type Path = PathElement[]

export function isArrayElement(el: PathElement): el is PathElementArray {
  return 'isArray' in el && el.isArray === true
}

export function isKeyElement(el: PathElement): el is PathElementKey {
  return !isArrayElement(el)
}

export type EntityLeafValueInfo = {
  path: Path
  pathKey: string
  type: LeafValueType
  options?: Array<{ title: string; value: string }>
}
export const ARRAY_ITEM_INDICATOR = '$i'

export function getPathKey(path: Path): string {
  return path
    .map((x) => (isArrayElement(x) ? ARRAY_ITEM_INDICATOR : x.key))
    .join('.')
}

export function parsePathKey(key: string): Path {
  return key.split('.').map((part) => {
    if (part === ARRAY_ITEM_INDICATOR) {
      return { isArray: true }
    }
    return { key: part, isArray: false }
  })
}

export const LABEL_SEPARATOR = ` > `

export function getPathLabel(path: Path) {
  return path
    .map((x) => {
      if (isArrayElement(x)) {
        return null
      }
      let humanised = humanizeAuto(x.key, {
        firstLetterUpper: false,
      })
      if (x.oneOfSubtype) {
        humanised = `${humanised}${LABEL_SEPARATOR}${humanizeAuto(
          x.oneOfSubtype,
          {
            firstLetterUpper: false,
          }
        )}`
      }
      return humanised
    })
    .filter(notEmpty)
    .join(LABEL_SEPARATOR)
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
  parentPath: Path = []
): EntityLeafValueInfo[] {
  const model = Models[modelName]
  if (model) {
    return getPublicModelLeafAttrs(model, parentPath)
  }
  return []
}

export function getPublicModelLeafAttrs(
  entityClass: typeof EntityModel,
  parentPath: Path = []
): EntityLeafValueInfo[] {
  const result: EntityLeafValueInfo[] = []

  for (const attribute of entityClass.attributeTypeMap) {
    const path: Path = [
      ...parentPath,
      attribute.baseName === ARRAY_ITEM_INDICATOR
        ? {
            isArray: true,
          }
        : {
            key: attribute.baseName,
          },
    ]
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
      const oneOfResult = attributeType.split(' | ').flatMap((type) =>
        getPublicModelLeafAttrsByName(
          type,
          path.map((x, i) => {
            if (i === 0 && !isArrayElement(x)) {
              return {
                ...x,
                oneOfSubtype: type,
              }
            }
            return x
          })
        )
      )
      mergeResultsByPathKey(oneOfResult, result)
    } else if (attributeType.startsWith('Array<')) {
      // Handle arrays
      const arrayType = attributeType.match(/Array<(.+)>/)?.[1]
      if (arrayType) {
        const arrayPath: Path = [...path, { isArray: true }]
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
  const index = info.path.findIndex(isArrayElement)
  return index !== -1 && index !== info.path.length - 1
}
export function isArrayLeafNode(info: EntityLeafValueInfo) {
  return info.path.findIndex(isArrayElement) === info.path.length - 1
}

export function isArrayIntermediateNodeandHasLeafArrayNode(
  info: EntityLeafValueInfo
) {
  const index = info.path.findIndex(isArrayElement)
  const reverseIndex = findLastIndex(info.path, isArrayElement)
  return (
    index !== -1 &&
    index !== info.path.length - 1 &&
    reverseIndex === info.path.length - 1
  )
}

function handleArrayTypes(
  arrayType: string,
  arrayPath: Path,
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
  path: Path,
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
