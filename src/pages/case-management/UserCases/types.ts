import { Case, InternalBusinessUser, InternalConsumerUser } from '@/apis';

export type TableItem = Case & {
  index: number;
  userId: string | null;
  user: InternalConsumerUser | InternalBusinessUser | null;
};
