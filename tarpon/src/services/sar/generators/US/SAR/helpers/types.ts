import { PartyType1 } from '@/services/sar/generators/US/SAR/resources/EFL_SARXBatchSchema.type'
import { ActivityPartyTypeCodes } from '@/services/sar/generators/US/SAR/helpers/constants'

export type PartyTypeCode = PartyType1
export type ActivityPartyTypeName = keyof typeof ActivityPartyTypeCodes
