export const isValidEmail = (email: string) => {
  // email validation regex
  // @example.com should fail
  // test@example should fail
  // aman@.com should fail
  // aman@ should fail
  // aman@test.one.com should pass
  // aman@test.one. should fail

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/

  return emailRegex.test(email)
}
