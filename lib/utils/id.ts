import { customAlphabet } from 'nanoid'

export function shortId(length = 8) {
  return customAlphabet('1234567890abcdef', length)()
}
