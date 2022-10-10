export const CURRENCY_SCHEMA = (params: { title?: string }) => {
  const { title = 'Currency code' } = params
  return {
    type: 'string',
    title: title,
    // todo: specify enum with all supported currency codes
  } as const
}
