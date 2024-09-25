import { UserSearchParams } from '..';
import { Adapter } from '@/utils/routing';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import { dayjs } from '@/utils/dayjs';
import { RiskLevel, UserRegistrationStatus } from '@/apis';

const DEFAULT_TIMESTAMP = [dayjs().subtract(1, 'month').startOf('day'), dayjs().endOf('day')];

export const queryAdapter: Adapter<UserSearchParams> = {
  serializer: (params: UserSearchParams) => {
    return {
      ...defaultQueryAdapter.serializer(params),
      riskLevels: params.riskLevels?.join(',') ?? '',
      createdTimestamp:
        params.createdTimestamp?.map((x) => dayjs(x).valueOf()).join(',') ??
        DEFAULT_TIMESTAMP.map((x) => x.valueOf()).join(','),
      userId: params.userId,
      tagKey: params.tagKey,
      tagValue: params.tagValue,
      userRegistrationStatus: params.userRegistrationStatus?.join(',') ?? '',
      riskLevelLocked: params.riskLevelLocked,
      isPepHit: params.isPepHit,
    };
  },
  deserializer: (raw): UserSearchParams => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      riskLevels: raw.riskLevels ? (raw.riskLevels.split(',') as RiskLevel[]) : undefined,
      createdTimestamp: raw.createdTimestamp
        ? raw.createdTimestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : DEFAULT_TIMESTAMP.map((x) => x.format()),
      userId: raw.userId,
      tagKey: raw.tagKey,
      tagValue: raw.tagValue,
      userRegistrationStatus: raw.userRegistrationStatus
        ? (raw.userRegistrationStatus.split(',') as UserRegistrationStatus[])
        : undefined,
      riskLevelLocked: raw.riskLevelLocked as 'true' | 'false' | undefined,
      isPepHit: raw.isPepHit as 'true' | 'false' | undefined,
    };
  },
};
