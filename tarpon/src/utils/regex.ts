// Copoied from https://github.com/sindresorhus/escape-string-regexp
export function escapeStringRegexp(string: string) {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string')
  }

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

export const removePunctuation = (input: string) => {
  const punctuation = /[.,/#!$%^&*;:?{}=\-_`~()]/g
  return input.replace(punctuation, '')
}

export const checkIfWebsite = (input: string | undefined | null) => {
  if (!input) {
    return false
  }
  const website = /^(https?:\/\/)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/
  return website.test(input)
}
