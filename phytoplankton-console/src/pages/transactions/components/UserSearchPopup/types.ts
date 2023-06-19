import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { neverReturn } from '@/utils/lang';

export type User = InternalBusinessUser | InternalConsumerUser;

export type Mode = 'ALL' | 'ORIGIN' | 'DESTINATION';

export function isMode(input: unknown): input is Mode {
  const inputAsMode = input as Mode;
  switch (inputAsMode) {
    case 'ALL':
    case 'ORIGIN':
    case 'DESTINATION':
      return true;
  }
  return neverReturn(inputAsMode, false);
}
