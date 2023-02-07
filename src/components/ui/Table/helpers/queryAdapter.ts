import { CommonParams } from '..';
import { DEFAULT_PAGE_SIZE } from '../consts';
import { Adapter } from '@/utils/routing';

export const defaultQueryAdapter: Adapter<CommonParams> = {
  serializer: (params: CommonParams) => {
    return {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
      sort: (params.sort ?? [])
        .map(([key, order]) => {
          if (order === 'descend') {
            return `-${key}`;
          }
          if (order === 'ascend') {
            return `${key}`;
          }
          return key;
        })
        .join(','),
    };
  },
  deserializer: (raw): CommonParams => {
    return {
      page: parseInt(raw.page ?? '') || 1,
      pageSize: parseInt(raw.pageSize ?? '') || DEFAULT_PAGE_SIZE,
      sort:
        raw.sort?.split(',').map((key) => {
          if (key.startsWith('-')) {
            return [key.substring(1), 'descend'];
          } else if (key.startsWith('+')) {
            return [key.substring(1), 'ascend'];
          }
          return [key, 'ascend'];
        }) ?? [],
    };
  },
};
