export const isValidEmail = (email: string) => {
  const emailRegex = new RegExp(
    '^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:.[a-zA-Z0-9-]+)*$'
  )
  return emailRegex.test(email)
}
