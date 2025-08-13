import { firstLetterUpper } from './humanize'

export const setUserAlias = (
  str: string | undefined,
  alias: string | undefined
) => {
  if (!alias) {
    return str ?? ''
  }
  if (!str) {
    return ''
  }

  const aliasUpper = firstLetterUpper(alias)

  return str
    .replace(/{{userAlias}}/g, alias)
    .replace(/{{UserAlias}}/g, aliasUpper)
    .replace(/\bUser\b/g, aliasUpper)
    .replace(/\buser\b/g, alias)
}
