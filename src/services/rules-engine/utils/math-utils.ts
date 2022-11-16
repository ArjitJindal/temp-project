export function multiplierFromPercents(percents: number): number {
  return percents / 100
}

export function multiplierToPercents(multiplier: number): number {
  return multiplier * 100
}

export const PERCENT_SCHEMA = (params: {
  title?: string
  description?: string | undefined
  maximum?: number | 'NO_MAXIMUM'
}) => {
  const { maximum, title, description } = params
  return {
    type: 'number',
    title: title,
    description,
    minimum: 0,
    maximum: maximum === 'NO_MAXIMUM' ? undefined : maximum ?? 100,
    nullable: true,
  } as const
}
