const isValidTimestamp = (_timestamp: string | number) => {
  const newTimestamp = new Date(_timestamp).getTime()
  return isNumeric(newTimestamp)
}

export const isNumeric = (n: any) => {
  return !isNaN(parseFloat(n)) && isFinite(n)
}

export const getTimstampBasedIDPrefix = (timestamp: any): string => {
  if (!isValidTimestamp(timestamp)) {
    throw Error(
      `Invalid timestamp: ${timestamp}. Please provide a EPOCH timestamp`
    )
  }
  const transactionTimestamp = timestamp.toString()
  let idPrefix = ''
  let iter = 0
  for (const letterStr of transactionTimestamp) {
    idPrefix += String.fromCharCode(97 + iter + parseInt(letterStr))
    iter++
  }
  return idPrefix
}
