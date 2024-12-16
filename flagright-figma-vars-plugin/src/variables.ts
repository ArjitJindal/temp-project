const LESS_NAME_GLOBAL_PREFIX = `figma-vars-`
const TS_NAME_GLOBAL_PREFIX = `FIGMA_VARS`

export interface CodeGenerator {
  generateName: (components: string[]) => string
  generateSimpleLiteral: (value: string | number | boolean) => string
  generateColorLiteral: (color: RGB | RGBA) => string
  generateVarReference: (name: string) => string
  generateVarDefinition: (name: string, value: string) => string
}

export const LESS_GENERATOR: CodeGenerator = {
  generateName: (components: string[]): string => {
    const name = components
      .map((x): string =>
        x
          .replace(/[^a-zA-Z0-9]/g, '-')
          .replace(/^-+|-+$/, '')
          .split(/-+/g)
          .map(
            (x, i) =>
              (i === 0 ? x[0].toLowerCase() : x[0].toUpperCase()) +
              x.substr(1).toLowerCase()
          )
          .join('')
      )
      .join('-')
    return `${LESS_NAME_GLOBAL_PREFIX}-${name}`
  },
  generateColorLiteral: getColorString,
  generateSimpleLiteral: (value) => {
    if (typeof value === 'number') {
      return `${value}px`
    }
    return `${value}`
  },
  generateVarReference: (name) => `@${name}`,
  generateVarDefinition(name: string, value: string) {
    return `@${name}: ${value};`
  },
}

export const TS_GENERATOR: CodeGenerator = {
  generateName: (components: string[]): string => {
    const name = components
      .map((x): string =>
        x.replace(/[^a-zA-Z0-9]+/g, '_').replace(/(^_+)|(_+$)/g, '')
      )
      .filter((x) => x !== '')
      .join('_')
    return `${TS_NAME_GLOBAL_PREFIX}_${name.toUpperCase()}`
  },
  generateSimpleLiteral: (value) => JSON.stringify(value),
  generateColorLiteral: (color) => `'${getColorString(color)}'`,
  generateVarReference: (name) => `${name}`,
  generateVarDefinition(name: string, value: string) {
    return `export const ${name} = ${value};`
  },
}

export async function serializeVariables(
  codeGenerator: CodeGenerator
): Promise<string> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const localVariables = await figma.variables.getLocalVariablesAsync()

  const referencedVars = await collectReferencedVars(
    collections,
    localVariables
  )
  const unreferencedVars = localVariables.filter(
    (x) => !referencedVars.some((y) => x.id === y.id)
  )
  const allVars = [...referencedVars, ...unreferencedVars]

  const rows = []
  for (const variable of allVars) {
    const collection = collections.find(
      (x) => x.id === variable.variableCollectionId
    )
    for (const mode of collection?.modes ?? []) {
      const name = await serializeName(codeGenerator, variable, mode)
      const value = await serializeValue(codeGenerator, variable, mode)
      rows.push(codeGenerator.generateVarDefinition(name, value))
    }
  }
  const fileContent = rows.join('\n')
  return fileContent
}

async function collectReferencedVars(
  collections: VariableCollection[],
  vars: Variable[]
): Promise<Variable[]> {
  const result: Variable[] = []

  async function traverse(vars: Variable[]): Promise<void> {
    for (const variable of vars) {
      const collection = collections.find(
        (x) => x.id === variable.variableCollectionId
      )
      for (const mode of collection?.modes ?? []) {
        const value: VariableValue | undefined =
          variable.valuesByMode[mode.modeId]
        if (value != null && typeof value === 'object' && 'type' in value) {
          const linkedVariable = await figma.variables.getVariableByIdAsync(
            value.id
          )
          if (linkedVariable == null) {
            throw new Error(`Unknown variable alias: ${value.id}`)
          }
          await traverse([linkedVariable])
          if (!result.some((x) => x.id === linkedVariable.id)) {
            result.push(linkedVariable)
          }
        }
      }
    }
  }

  await traverse(vars)
  return result
}

export async function serializeName(
  codeGenerator: CodeGenerator,
  variable: Variable,
  mode: {
    modeId: string
    name: string
  }
) {
  const collection = await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  )
  if (collection == null) {
    throw new Error(`Unknown collection id: ${variable.variableCollectionId}`)
  }
  const collectionName = collection.name.replace(/^\d+\.\s*/, '')
  const variableName = variable.name
  const modeName = collection.modes.length > 1 ? mode.name : null
  return codeGenerator.generateName(
    [collectionName, variableName, modeName].filter(
      (x: string | null): x is string => x != null
    )
  )
}

export async function serializeValue(
  codeGenerator: CodeGenerator,
  variable: Variable,
  mode: {
    modeId: string
    name: string
  }
): Promise<string> {
  const value: VariableValue | undefined = variable.valuesByMode[mode.modeId]
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    value == null
  ) {
    return codeGenerator.generateSimpleLiteral(value)
  }
  if ('type' in value) {
    const linkedVariable = await figma.variables.getVariableByIdAsync(value.id)
    if (linkedVariable == null) {
      throw new Error(`Unknown variable alias: ${value.id}`)
    }
    const collection = await figma.variables.getVariableCollectionByIdAsync(
      linkedVariable.variableCollectionId
    )
    if (collection == null) {
      throw new Error(
        `Unknown collection : ${linkedVariable.variableCollectionId}`
      )
    }
    const firstMode = collection.modes[0]
    if (firstMode == null) {
      throw new Error(
        `Collection "${collection.name}" doesn't have modes, impossible to resolve an alias`
      )
    }
    const name = await serializeName(codeGenerator, linkedVariable, firstMode)
    return codeGenerator.generateVarReference(name)
  }

  return codeGenerator.generateColorLiteral(value)
}

function getColorString(color: RGB | RGBA): string {
  const components = [
    color.r,
    color.g,
    color.b,
    ...('a' in color && color.a !== 1 ? [color.a] : []),
  ]
    .map((x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()
  return `#${components}`
}
