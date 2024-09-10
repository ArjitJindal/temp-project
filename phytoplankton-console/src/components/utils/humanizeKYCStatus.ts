import { humanizeConstant } from '@flagright/lib/utils/humanize';

import { KYCStatus } from '@/apis';

export function humanizeKYCStatus(state: KYCStatus): string {
  if (state === 'EDD_IN_PROGRESS') {
    return 'EDD in progress';
  }
  return humanizeConstant(state);
}
