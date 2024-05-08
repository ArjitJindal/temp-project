import { Lookup } from 'geoip-lite'

export async function lookupIpLocation(
  ipAddress: string
): Promise<Lookup | null> {
  // NOTE: importing geoip-lite will load the geoip database into memory. we only do it on demand.
  // It'll only be loaded once. The subsequent calls will use the cached database.
  const geoIp = (await import('geoip-lite')).default
  return geoIp.lookup(ipAddress)
}
