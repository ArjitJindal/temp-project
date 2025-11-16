import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import PageWrapper from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import Stepper, { Step } from '@/components/library/Stepper';
import Button from '@/components/library/Button';
import FileUploadStep from '@/pages/transactions-import/FileUploadStep';
import DataMappingStep from '@/pages/transactions-import/DataMappingStep';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useApi } from '@/api';
import { FileInfo } from '@/apis';
import { message } from '@/components/library/Message';
import { useQuery } from '@/utils/queries/hooks';
import DataValidationStep from '@/pages/transactions-import/DataValidationStep';
import { AsyncResource, getOr, isLoading, map, success } from '@/utils/asyncResource';
import { FLAT_FILE_PROGRESS } from '@/utils/queries/keys';
import {
  FileImportApiData,
  FlatImportProgress,
  isImportResultsAvailable,
  isOngoingImport,
  isValidationJobFound,
} from '@/pages/transactions-import/helpers';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

type StepKey = 'UPLOAD_FILE' | 'DATA_MAPPING' | 'DATA_VALIDATION';

export default function TransactionsImportPage() {
  const [selectedStep, setSelectedStep] = useState<StepKey>('UPLOAD_FILE');
  const [file, setFile] = useState<FileInfo>();

  const queryClient = useQueryClient();
  const api = useApi();

  const apiProgressRes = useProgressResource();

  const fileUploadMutation = useMutation<unknown, unknown, { file: FileInfo }>(
    async (variables) => {
      try {
        setSelectedStep('DATA_VALIDATION');
        return await api.postTransactionFlatFileUpload({
          TransactionFlatFileUploadRequest: {
            file: variables.file,
          },
        });
      } finally {
        setFile(undefined);
      }
    },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries(FLAT_FILE_PROGRESS('TRANSACTIONS'));
      },
      onError: async (e) => {
        message.fatal('Unable to upload file for import. ', e);
        await queryClient.invalidateQueries(FLAT_FILE_PROGRESS('TRANSACTIONS'));
      },
    },
  );

  const progressRes = useMemo((): AsyncResource<FlatImportProgress> => {
    if (isLoading(fileUploadMutation.dataResource)) {
      return success({ kind: 'UPLOADING' });
    } else {
      const apiProgressValue = getOr(apiProgressRes, null);
      if (
        apiProgressValue?.kind === 'IMPORT_DONE' ||
        apiProgressValue?.kind === 'IMPORT_IN_PROGRESS' ||
        apiProgressValue?.kind === 'VALIDATION_IN_PROGRESS' ||
        apiProgressValue?.kind === 'VALIDATION_PENDING'
      ) {
        return success({ kind: 'API_DATA', value: apiProgressValue });
      } else {
        return map(fileUploadMutation.dataResource, () => ({ kind: 'WAITING_FOR_JOB_START' }));
      }
    }
  }, [fileUploadMutation, apiProgressRes]);

  const progressResValue = getOr(progressRes, null);

  const isInProgress = isOngoingImport(progressResValue);
  const isJobFound = isValidationJobFound(progressResValue);
  const isResultsAvailable = isImportResultsAvailable(progressResValue);

  const isUploadStepDisabled = isInProgress;
  const isDataValidationStepDisabled = !(isInProgress || isJobFound || isResultsAvailable);

  const activeStep = isUploadStepDisabled
    ? 'DATA_VALIDATION'
    : isDataValidationStepDisabled
    ? 'UPLOAD_FILE'
    : selectedStep;

  const steps = useMemo(() => {
    const steps: Step<StepKey>[] = [];
    steps.push({
      key: 'UPLOAD_FILE',
      title: 'Upload file',
      isDisabled: isLoading(apiProgressRes) || isUploadStepDisabled,
    });
    // not supported yet
    // steps.push({ key: 'DATA_MAPPING', title: 'Data mapping', isDisabled: file == null })
    steps.push({
      key: 'DATA_VALIDATION',
      title: 'Import progress',
      isDisabled: isLoading(apiProgressRes) || isDataValidationStepDisabled,
    });
    return steps;
  }, [apiProgressRes, isUploadStepDisabled, isDataValidationStepDisabled]);

  return (
    <PageWrapper
      header={
        <div className={s.header}>
          <Breadcrumbs
            items={[
              { title: 'Transactions', to: '/transactions' },
              { title: 'Import CSV', to: '/transactions/import/csv' },
            ]}
          />
          <Stepper<StepKey> active={activeStep} onChange={setSelectedStep} steps={steps} />
        </div>
      }
      footer={
        <div className={s.footer}>
          <Button
            type={'PRIMARY'}
            isLoading={isLoading(fileUploadMutation.dataResource)}
            isDisabled={activeStep !== 'UPLOAD_FILE' || file == null || isInProgress}
            onClick={() => {
              if (activeStep === 'UPLOAD_FILE') {
                if (file == null) {
                  throw new Error('File is not provided');
                }
                fileUploadMutation.mutate({ file });
              }
            }}
          >
            Continue
          </Button>
          {/*<Button type={'TETRIARY'} isDisabled={isInProgress}>*/}
          {/*  Cancel*/}
          {/*</Button>*/}
        </div>
      }
      enableTopPadding={true}
    >
      <AsyncResourceRenderer resource={apiProgressRes}>
        {() => (
          <>
            {activeStep === 'UPLOAD_FILE' && (
              <FileUploadStep
                selectedFile={file}
                progressRes={progressRes}
                onFileUpload={(file) => {
                  setFile(file);
                }}
              />
            )}
            {activeStep === 'DATA_MAPPING' && <DataMappingStep />}
            {activeStep === 'DATA_VALIDATION' && <DataValidationStep progressRes={progressRes} />}
          </>
        )}
      </AsyncResourceRenderer>
    </PageWrapper>
  );
}

/*
  Helpers
 */
function useProgressResource(): AsyncResource<FileImportApiData> {
  const api = useApi();
  const ongoingImportsProgressQueryResult = useQuery(
    FLAT_FILE_PROGRESS('TRANSACTIONS'),
    async (): Promise<FileImportApiData> => {
      const response = await api.getFlatFilesProgress({
        schema: 'TRANSACTIONS_UPLOAD',
        entityId: 'TRANSACTIONS',
      });
      let value: FileImportApiData = {
        kind: 'NOT_FOUND',
      };
      if (response == null) {
        value = {
          kind: 'NOT_FOUND',
        };
      } else if (response.isValidationJobRunning) {
        value = {
          kind: 'VALIDATION_IN_PROGRESS',
          // total: response.total, // this just equals to precessed atm, consider total as always unknown for now
          processed: response.processed,
          errored: response.errored,
          succeeded: response.saved,
        };
      } else if (response.status === 'PENDING') {
        value = {
          kind: 'VALIDATION_PENDING',
        };
      } else if (response.status === 'IN_PROGRESS') {
        value = {
          kind: 'IMPORT_IN_PROGRESS',
          total: response.total,
          processed: response.processed,
          errored: response.errored,
          succeeded: response.saved,
        };
      } else if (response.status === 'SUCCESS' || response.status === 'FAILED') {
        value = {
          kind: 'IMPORT_DONE',
          total: response.total,
          errored: response.errored,
          succeeded: response.saved,
          errorsFileUrl: response.erroredRecordsFileUrl,
        };
      }
      return value;
    },
    {
      refetchInterval: (progress) => {
        if (
          progress != null &&
          (progress.kind === 'IMPORT_IN_PROGRESS' ||
            progress.kind === 'VALIDATION_IN_PROGRESS' ||
            progress.kind === 'VALIDATION_PENDING')
        ) {
          return 3000;
        }
        return 60000;
      },
    },
  );
  return ongoingImportsProgressQueryResult.data;
}
