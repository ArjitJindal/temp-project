import { AsyncResource } from '@/utils/asyncResource';

export type QueryResult<Data> = {
  data: AsyncResource<Data>;
  refetch: () => void;
};
