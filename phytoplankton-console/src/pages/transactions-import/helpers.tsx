export type FileImportApiData =
  | {
      kind: 'IMPORT_DONE';
      total?: number;
      errored?: number;
      succeeded?: number;
      errorsFileUrl?: string;
    }
  | {
      kind: 'IMPORT_IN_PROGRESS';
      total?: number;
      processed?: number;
      errored?: number;
      succeeded?: number;
    }
  | {
      kind: 'VALIDATION_IN_PROGRESS';
      total?: number;
      processed?: number;
      errored?: number;
      succeeded?: number;
    }
  | {
      kind: 'VALIDATION_PENDING';
    }
  | {
      kind: 'NOT_FOUND';
    };

export type FlatImportProgress =
  | {
      kind: 'API_DATA';
      value: FileImportApiData;
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
  return (
    progress.value.kind === 'IMPORT_IN_PROGRESS' ||
    progress.value.kind === 'VALIDATION_IN_PROGRESS' ||
    progress.value.kind === 'VALIDATION_PENDING'
  );
}

export function isValidationJobFound(progress: FlatImportProgress | null): boolean {
  if (
    progress == null ||
    progress.kind === 'WAITING_FOR_JOB_START' ||
    progress.kind === 'UPLOADING'
  ) {
    return false;
  }

  if (
    progress.value.kind === 'VALIDATION_IN_PROGRESS' ||
    progress.value.kind === 'IMPORT_IN_PROGRESS'
  ) {
    return true;
  }

  return false;
}

export function isImportResultsAvailable(progress: FlatImportProgress | null): boolean {
  if (
    progress == null ||
    progress.kind === 'WAITING_FOR_JOB_START' ||
    progress.kind === 'UPLOADING'
  ) {
    return false;
  }

  return progress.value.kind === 'IMPORT_DONE';
}
