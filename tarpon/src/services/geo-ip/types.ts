export type ResolutionType = 'CITY' | 'COUNTRY'

export interface IpLookupProvider {
  source?: string
  enabled(): boolean
  cacheable(): boolean
  resolveIp(
    ip: string,
    resolutionType: ResolutionType
  ): Promise<IpLocation | undefined>
}

export type IpLocation = {
  country?: string
  continent?: string
  city?: string
}
