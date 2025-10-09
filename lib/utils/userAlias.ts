import pluralize from 'pluralize'
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
  const aliasPlural = pluralize(alias)
  const aliasPluralUpper = firstLetterUpper(aliasPlural)

  return str
    .replace(/{{userAlias}}/g, alias)
    .replace(/{{UserAlias}}/g, aliasUpper)
    .replace(/\bUser\b/g, aliasUpper)
    .replace(/\buser\b/g, alias)
    .replace(/\bUsers\b/g, aliasPluralUpper)
    .replace(/\busers\b/g, aliasPlural)
}
