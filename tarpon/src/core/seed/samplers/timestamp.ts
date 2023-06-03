export const sampleTimestamp = (
  seed?: number | undefined,
  backTo = 3600 * 365 * 24 * 1000
) => {
  return Date.now() - Math.round(Math.random() * backTo)
}
