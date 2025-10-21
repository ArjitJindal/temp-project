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
import { FileInfo, FlatFileProgressResponse } from '@/apis';
import { message } from '@/components/library/Message';
import { useQuery } from '@/utils/queries/hooks';
import DataValidationStep from '@/pages/transactions-import/DataValidationStep';
import { AsyncResource, getOr, isLoading, map, success } from '@/utils/asyncResource';
import { FLAT_FILE_PROGRESS } from '@/utils/queries/keys';
import {
  FlatImportProgress,
  isImportResultsAvailable,
  isOngoingImport,
  isValidationJobFound,
} from '@/pages/transactions-import/helpers';

type StepKey = 'UPLOAD_FILE' | 'DATA_MAPPING' | 'DATA_VALIDATION';

export default function TransactionsImport() {
  const [selectedStep, setSelectedStep] = useState<StepKey>('UPLOAD_FILE');
  const [file, setFile] = useState<FileInfo>();

  const queryClient = useQueryClient();
  const api = useApi();

  const apiProgressRes = useProgressResource();

  const fileUploadMutation = useMutation<unknown, unknown, { file: FileInfo }>(
    async (variables) => {
      // const dismissLoading = message.loading('Uploading file for import...');
      try {
        setSelectedStep('DATA_VALIDATION');
        return await api.postTransactionFlatFileUpload({
          TransactionFlatFileUploadRequest: {
            file: variables.file,
          },
        });
      } finally {
        // dismissLoading();
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
      if (isValidationJobFound(apiProgressValue) || isImportResultsAvailable(apiProgressValue)) {
        return apiProgressRes;
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
      isDisabled: isUploadStepDisabled,
    });
    // not supported yet
    // steps.push({ key: 'DATA_MAPPING', title: 'Data mapping', isDisabled: file == null })
    steps.push({
      key: 'DATA_VALIDATION',
      title: 'Data validation',
      isDisabled: isDataValidationStepDisabled,
    });
    return steps;
  }, [isUploadStepDisabled, isDataValidationStepDisabled]);

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
          <Button type={'TETRIARY'} isDisabled={isInProgress}>
            Cancel
          </Button>
        </div>
      }
      enableTopPadding={true}
    >
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
    </PageWrapper>
  );
}

function useProgressResource(): AsyncResource<FlatImportProgress> {
  const api = useApi();
  const ongoingImportsProgressQueryResult = useQuery(
    FLAT_FILE_PROGRESS('TRANSACTIONS'),
    async (): Promise<{ kind: 'API_DATA'; value: FlatFileProgressResponse }> => {
      const response = await api.getFlatFilesProgress({
        schema: 'TRANSACTIONS_UPLOAD',
        entityId: 'TRANSACTIONS',
      });
      return { kind: 'API_DATA', value: response };
    },
    {
      refetchInterval: (progress) => {
        if (
          progress != null &&
          (progress.value.status === 'PENDING' || progress.value.status === 'IN_PROGRESS')
        ) {
          return 3000;
        }
        return 60000;
      },
      backgroundFetch: true,
    },
  );
  return ongoingImportsProgressQueryResult.data;
}
