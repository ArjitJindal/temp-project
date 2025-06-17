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
  return str
    .replace('{{userAlias}}', alias || '')
    .replace('{{UserAlias}}', firstLetterUpper(alias) || '')
}
