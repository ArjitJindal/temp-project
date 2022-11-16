export const CURRENCY_SCHEMA = (params: {
  title?: string
  description?: string
}) => {
  const { title = 'Currency code', description } = params
  return {
    type: 'string',
    title,
    description,
    // todo: specify enum with all supported currency codes
  } as const
}
