import { GeoIp2Provider } from './geoIp'
import { IpGeolocationProvider } from './ipGeolocation'

export const GEO_IP_PROVIDERS = [
  new GeoIp2Provider(),
  new IpGeolocationProvider(),
]
