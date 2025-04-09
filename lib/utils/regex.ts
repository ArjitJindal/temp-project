export const isValidEmail = (email: string) => {
  // email validation regex
  // @example.com should fail
  // test@example should fail
  // aman@.com should fail
  // aman@ should fail
  // aman@test.one.com should pass
  // aman@test.one. should fail
  // test@example.photography should pass
  // test@example.c should fail
  // test@domain-with-hyphen.com should pass
  // test@-start-hyphen.com should fail
  // test@end-hyphen-.com should fail
  // test@domain..com should fail

  if (email.length > 254) return false // As per RFC standards

  const localPart = email.split('@')[0]
  if (localPart.length > 64) return false

  const emailRegex =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9._+-]*[a-zA-Z0-9])?@([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

  const hasConsecutiveSpecialChars = /[._+-]{2,}/.test(localPart)

  return emailRegex.test(email) && !hasConsecutiveSpecialChars
}
