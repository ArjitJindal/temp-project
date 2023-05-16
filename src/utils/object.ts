import crypto from 'crypto'
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
