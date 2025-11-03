import { AdverseMediaSourceRelevance } from '@/@types/openapi-internal/AdverseMediaSourceRelevance'
import { PEPSourceRelevance } from '@/@types/openapi-internal/PEPSourceRelevance'
import { RELSourceRelevance } from '@/@types/openapi-internal/RELSourceRelevance'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSourceRelevance } from '@/@types/openapi-internal/SanctionsSourceRelevance'

export enum SanctionsDataProviders {
  ACURIS = 'acuris',
  DOW_JONES = 'dowjones',
  OPEN_SANCTIONS = 'open-sanctions',
  LSEG = 'lseg',
  LIST = 'list',
}

export interface SanctionsSearchProps {
  sanctionSourceIds?: string[]
  pepSourceIds?: string[]
  relSourceIds?: string[]
  sanctionsCategory?: SanctionsSourceRelevance[]
  pepCategory?: PEPSourceRelevance[]
  relCategory?: RELSourceRelevance[]
  adverseMediaCategory?: AdverseMediaSourceRelevance[]
  containAllSources?: boolean
  crimeCategory?: string[]
}
export interface SanctionsSearchPropsWithRequest extends SanctionsSearchProps {
  request: SanctionsSearchRequest
  limit?: number
}

export interface SanctionsSearchPropsWithData extends SanctionsSearchProps {
  data: SanctionsEntity[] | undefined
}

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
}
