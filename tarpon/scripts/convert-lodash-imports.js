export default function transformer(file, api) {
  const j = api.jscodeshift
  const root = j(file.source)

  root
    .find(j.ImportDeclaration, { source: { value: 'lodash' } })
    .forEach((path) => {
      const { specifiers } = path.node
      if (!specifiers || specifiers.length === 0) return

      const runtimeImports = []
      const typeImports = []

      specifiers.forEach((spec) => {
        if (spec.type !== 'ImportSpecifier') return

        const name = spec.imported.name

        if (/^[A-Z]/.test(name)) {
          // ✅ Force all PascalCase names into type imports
          typeImports.push(spec)
        } else {
          // ✅ Only camelCase go to lodash/<method>
          runtimeImports.push(
            j.importDeclaration(
              [j.importDefaultSpecifier(j.identifier(name))],
              j.literal(`lodash/${name}`)
            )
          )
        }
      })

      const replacements = []

      if (typeImports.length > 0) {
        const typeDecl = j.importDeclaration(typeImports, j.literal('lodash'))
        typeDecl.importKind = 'type'
        replacements.push(typeDecl)
      }

      replacements.push(...runtimeImports)

      // Replace with clean set of imports
      j(path).replaceWith(replacements)
    })

  return root.toSource({ quote: 'single' })
}
