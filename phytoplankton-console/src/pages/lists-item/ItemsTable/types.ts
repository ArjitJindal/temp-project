import { CountryCode } from '@flagright/lib/constants';
import { CommonParams } from '@/components/library/Table/types';

export type TableParams = CommonParams & {
  search?: string;
  country?: CountryCode[];
  userId?: string;
};
