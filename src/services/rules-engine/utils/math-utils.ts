export function multiplierFromPercents(percents: number): number {
  return percents / 100
}

export function multiplierToPercents(multiplier: number): number {
  return multiplier * 100
}

export const PERCENT_SCHEMA = (params: {
  title?: string
  maximum?: number | 'NO_MAXIMUM'
}) => {
  const { maximum, title } = params
  return {
    type: 'number',
    title: title,
    minimum: 0,
    maximum: maximum === 'NO_MAXIMUM' ? undefined : maximum ?? 100,
    nullable: true,
  } as const
}
