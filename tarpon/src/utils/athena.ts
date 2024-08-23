const structRe = /^{.*?(?:(?:(?:},\s*?{)|,|{|)\s*?(?:\w+)=).*?}$/
const looseStructRe = /{.*?(?:(?:(?:},\s*?{)|,|{|)\s*?(?:\w+)=).*?}/

const toKeyVal = (struct: string): string[] => {
  let insideNestedStruct = 0
  let insideArray = 0
  const structToKeyVal: string[] = []
  let startSlice = 0
  let keyValueSingePair: any = []

  const splitKeyValue = (keyValue: string): string[] =>
    splitTail(keyValue.trim(), '=', 2)

  for (let i = 0; i < struct.length; i++) {
    if (struct[i] === '{') {
      insideNestedStruct++
    } else if (struct[i] === '}') {
      insideNestedStruct--
    } else if (struct[i] === '[') {
      insideArray++
    } else if (struct[i] === ']') {
      insideArray--
    }
    if (insideNestedStruct === 0 && insideArray === 0) {
      if (struct[i] === ',') {
        keyValueSingePair = struct.slice(startSlice, i)
        structToKeyVal.push(...splitKeyValue(keyValueSingePair))
        startSlice = i + 1
      }
    }
  }
  structToKeyVal.push(...splitKeyValue(struct.slice(startSlice, struct.length)))
  return structToKeyVal
}

const splitTail = (str: string, delim: string, count: number): string[] => {
  const arr = str.split(delim)
  return [...arr.splice(0, count - 1), arr.join(delim)]
}

const isArray = (value: string): boolean =>
  value[0] === '[' && value[value.length - 1] === ']'
const isStruct = (value: string): boolean => structRe.test(value.trim())
const isNumber = (value: string): boolean => !isNaN(Number(value))

export const parseValue = (value: string): any => {
  if (value === 'false') {
    return false
  } else if (value === 'true') {
    return true
  } else if (value === 'null') {
    return null
  } else if (isNumber(value)) {
    return parseNumber(value)
  } else if (isArray(value)) {
    return parseArray(value).map((val) => parseValue(val))
  } else if (isStruct(value)) {
    return parseStruct(value)
  }

  return value
}

const ObjectStates = {
  KEY: 'key',
  VALUE: 'value',
}

export const parseStruct = (struct: string): Record<string, any> => {
  const trimmed = struct.trim()
  struct = trimmed
    .substring(0, trimmed.length - 1)
    .substring(1)
    .trim()
  const keyValuePairs = toKeyVal(struct)
  const obj: Record<string, any> = {}

  const state: { type: string; key?: string } = {
    type: ObjectStates.KEY,
  }

  for (let i = 0; i < keyValuePairs.length; i++) {
    const item = keyValuePairs[i]

    if (item.trim() === '') {
      continue
    }

    if (
      state.type === ObjectStates.KEY &&
      item === '' &&
      keyValuePairs[i - 1] &&
      keyValuePairs[i - 1][0] === '['
    ) {
      continue
    }

    if (state.type === ObjectStates.KEY) {
      state.key = item
      state.type = ObjectStates.VALUE
      continue
    }

    if (
      state.type === ObjectStates.VALUE &&
      item === '' &&
      keyValuePairs[i + 1] &&
      keyValuePairs[i + 1][0] === '['
    ) {
      continue
    }

    if (state.type === ObjectStates.VALUE) {
      const { key } = state
      delete state.key

      if (key) {
        obj[key] = parseValue(item)
      }
      state.type = ObjectStates.KEY
      continue
    }
  }

  return obj
}

const splitByBoundingChars = (
  value: string,
  leftChar: string,
  rightChar: string
): string[] => {
  const list: string[] = []

  let depth = 0
  let str = ''
  for (let i = 0; i < value.length; i++) {
    const char = value[i]

    if (depth !== 0) {
      str = `${str}${char}`
    }

    if (char === leftChar) {
      depth += 1
      str = leftChar
      continue
    } else if (depth === 0) {
      continue
    }

    if (char === rightChar) {
      depth -= 1
    }

    if (depth === 0) {
      list.push(str)
      str = ''
    }
  }

  return list
}

const parseArray = (value: string): string[] => {
  const noBrackets = value
    .trim()
    .substring(0, value.length - 1)
    .substring(1)

  if (looseStructRe.test(noBrackets)) {
    return splitByBoundingChars(noBrackets, '{', '}')
  } else if (isArray(noBrackets)) {
    return splitByBoundingChars(noBrackets, '[', ']')
  }

  return noBrackets.split(/,\s*/)
}

const parseNumber = (value: string): number => Number(value)
