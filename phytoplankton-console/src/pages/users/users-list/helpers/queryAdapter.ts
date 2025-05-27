import { UserSearchParams } from '..';
import { Adapter } from '@/utils/routing';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import { dayjs } from '@/utils/dayjs';
import { PepRank, CountryCode, RiskLevel, UserRegistrationStatus } from '@/apis';

export const queryAdapter: Adapter<UserSearchParams> = {
  serializer: (params: UserSearchParams) => {
    return {
      ...defaultQueryAdapter.serializer(params),
      riskLevels: params.riskLevels?.join(',') ?? '',
      createdTimestamp: params.createdTimestamp?.map((x) => dayjs(x).valueOf()).join(','),
      userId: params.userId,
      parentUserId: params.parentUserId,
      tagKey: params.tagKey,
      tagValue: params.tagValue,
      userRegistrationStatus: params.userRegistrationStatus?.join(',') ?? '',
      riskLevelLocked: params.riskLevelLocked,
      isPepHit: params.isPepHit,
      pepCountry: params.pepCountry?.join(',') ?? '',
      pepRank: params.pepRank,
      countryOfNationality: params.countryOfNationality?.join(',') ?? '',
      countryOfResidence: params.countryOfResidence?.join(',') ?? '',
    };
  },
  deserializer: (raw): UserSearchParams => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      riskLevels: raw.riskLevels ? (raw.riskLevels.split(',') as RiskLevel[]) : undefined,
      createdTimestamp: raw.createdTimestamp
        ? raw.createdTimestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : undefined,
      userId: raw.userId,
      parentUserId: raw.parentUserId,
      tagKey: raw.tagKey,
      tagValue: raw.tagValue,
      userRegistrationStatus: raw.userRegistrationStatus
        ? (raw.userRegistrationStatus.split(',') as UserRegistrationStatus[])
        : undefined,
      riskLevelLocked: raw.riskLevelLocked as 'true' | 'false' | undefined,
      isPepHit: raw.isPepHit as 'true' | 'false' | undefined,
      pepCountry: raw.pepCountry ? (raw.pepCountry.split(',') as CountryCode[]) : undefined,
      pepRank: raw.pepRank as PepRank | undefined,
      countryOfNationality: raw.countryOfNationality
        ? (raw.countryOfNationality.split(',') as CountryCode[])
        : undefined,
      countryOfResidence: raw.countryOfResidence
        ? (raw.countryOfResidence.split(',') as CountryCode[])
        : undefined,
    };
  },
};
