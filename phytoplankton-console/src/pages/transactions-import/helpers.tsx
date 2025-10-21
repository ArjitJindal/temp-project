import { FlatFileProgressResponse } from '@/apis';

export type FlatImportProgress =
  | {
      kind: 'API_DATA';
      value: FlatFileProgressResponse;
    }
  | {
      kind: 'UPLOADING';
    }
  | {
      kind: 'WAITING_FOR_JOB_START';
    };

export function isOngoingImport(progress: FlatImportProgress | null): boolean {
  if (progress == null) {
    return false;
  }
  if (progress.kind === 'UPLOADING') {
    return true;
  }
  if (progress.kind === 'WAITING_FOR_JOB_START') {
    return true;
  }
  return progress.value.status === 'PENDING' || progress.value.status === 'IN_PROGRESS';
}

export function isValidationJobFound(progress: FlatImportProgress | null): boolean {
  if (
    progress == null ||
    progress.kind === 'WAITING_FOR_JOB_START' ||
    progress.kind === 'UPLOADING'
  ) {
    return false;
  }

  return (
    progress.value.isValidationJobFound === true || progress.value.isValidationJobRunning === true
  );
}

export function isImportResultsAvailable(progress: FlatImportProgress | null): boolean {
  if (
    progress == null ||
    progress.kind === 'WAITING_FOR_JOB_START' ||
    progress.kind === 'UPLOADING'
  ) {
    return false;
  }

  return progress.value.status === 'SUCCESS';
}
