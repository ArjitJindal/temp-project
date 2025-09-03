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
import { AsyncResource, isLoading, isSuccess } from '@/utils/asyncResource';
import { FLAT_FILE_PROGRESS } from '@/utils/queries/keys';
import { isOngoingImport } from '@/pages/transactions-import/helpers';

type StepKey = 'UPLOAD_FILE' | 'DATA_MAPPING' | 'DATA_VALIDATION';

export default function TransactionsImport() {
  const [activeStep, setActiveStep] = useState<StepKey>('UPLOAD_FILE');
  const [file, setFile] = useState<FileInfo>();

  const queryClient = useQueryClient();
  const api = useApi();

  const progressRes = useProgressResource();

  const fileUploadMutation = useMutation<unknown, unknown, { file: FileInfo }>(
    async (variables) => {
      const dismissLoading = message.loading('Uploading file for import...');
      try {
        return await api.postTransactionFlatFileUpload({
          TransactionFlatFileUploadRequest: {
            file: variables.file,
          },
        });
      } finally {
        dismissLoading();
        setFile(undefined);
        setActiveStep('DATA_VALIDATION');
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

  const steps = useMemo(() => {
    const steps: Step<StepKey>[] = [];
    steps.push({
      key: 'UPLOAD_FILE',
      title: 'Upload file',
    });
    // not supported yet
    // steps.push({ key: 'DATA_MAPPING', title: 'Data mapping', isDisabled: file == null })
    steps.push({
      key: 'DATA_VALIDATION',
      title: 'Data validation',
    });
    return steps;
  }, []);

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
          <Stepper<StepKey> active={activeStep} onChange={setActiveStep} steps={steps} />
        </div>
      }
      footer={
        <div className={s.footer}>
          <Button
            type={'TETRIARY'}
            isLoading={isLoading(fileUploadMutation.dataResource)}
            isDisabled={
              activeStep !== 'UPLOAD_FILE' ||
              file == null ||
              isLoading(progressRes) ||
              (isSuccess(progressRes) && isOngoingImport(progressRes.value))
            }
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
          <Button type={'TETRIARY'}>Cancel</Button>
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

/*
  Helpers
 */
function useProgressResource(): AsyncResource<FlatFileProgressResponse> {
  const api = useApi();
  const ongoingImportsProgressQueryResult = useQuery(
    FLAT_FILE_PROGRESS('TRANSACTIONS'),
    async () => {
      return await api.getFlatFilesProgress({
        schema: 'TRANSACTIONS_UPLOAD',
        entityId: 'TRANSACTIONS',
      });
    },
    {
      refetchInterval: (progress) => {
        if (
          progress != null &&
          (progress.status === 'PENDING' || progress.status === 'IN_PROGRESS')
        ) {
          return 5000;
        }
        return 60000;
      },
      backgroundFetch: true,
    },
  );
  return ongoingImportsProgressQueryResult.data;
}
