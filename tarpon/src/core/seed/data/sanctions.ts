import s1Response from './raw-data/search1.json'
import s2Response from './raw-data/search2.json'
import s3Response from './raw-data/search3.json'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
const data: SanctionsSearchHistory[] = [
  s1Response,
  s2Response,
  s3Response,
] as unknown as SanctionsSearchHistory[]

const init = () => undefined

export { init, data }
