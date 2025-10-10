import { isCountryCode } from '@flagright/lib/constants';
import { TableParams } from './types';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import { Adapter } from '@/utils/routing';

export const queryAdapter: Adapter<TableParams> = {
  serializer: (params) => {
    return {
      ...defaultQueryAdapter.serializer(params),
      search: params.search,
      userId: params.userId,
      country: params.country?.join(','),
    };
  },
  deserializer: (raw): TableParams => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      search: raw.search,
      userId: raw.userId,
      country: raw.country?.split(',').filter(isCountryCode),
    };
  },
};
