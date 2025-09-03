import { FlatFileProgressResponse } from '@/apis';

export function isOngoingImport(progress: FlatFileProgressResponse): boolean {
  return progress.status === 'PENDING' || progress.status === 'IN_PROGRESS';
}
