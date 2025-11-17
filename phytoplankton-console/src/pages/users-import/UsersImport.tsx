import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import PageWrapper from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import Stepper, { Step } from '@/components/library/Stepper';
import Button from '@/components/library/Button';
import FileUploadStep from '@/pages/users-import/FileUploadStep';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useApi } from '@/api';
import { FileInfo, FlatFileProgressResponse, UserFlatFileUploadRequest } from '@/apis';
import { message } from '@/components/library/Message';
import { useQuery } from '@/utils/queries/hooks';
import DataValidationStep from '@/pages/users-import/DataValidationStep';
import { AsyncResource, isLoading, isSuccess } from '@/utils/asyncResource';
import { FLAT_FILE_PROGRESS } from '@/utils/queries/keys';
import {
  getTypeFromUrl,
  getUserEntityId,
  getUserSchemaType,
  isOngoingImport,
} from '@/pages/users-import/helpers';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

type StepKey = 'UPLOAD_FILE' | 'DATA_VALIDATION';

export default function UsersImport() {
  const { list = 'consumer' } = useParams<'list'>() as {
    list: 'business' | 'consumer';
  };
  const userType = getTypeFromUrl(list);

  const [activeStep, setActiveStep] = useState<StepKey>('UPLOAD_FILE');
  const [file, setFile] = useState<FileInfo>();
  const settings = useSettings();

  const queryClient = useQueryClient();
  const api = useApi();

  const progressRes = useProgressResource(userType);

  const fileUploadMutation = useMutation<unknown, unknown, { file: FileInfo }>(
    async (variables) => {
      const dismissLoading = message.loading('Uploading file for import...');
      try {
        return await api.postUsersFlatFileUpload({
          UserFlatFileUploadRequest: {
            file: variables.file,
            type: userType.toUpperCase() as UserFlatFileUploadRequest['type'],
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
        await queryClient.invalidateQueries(FLAT_FILE_PROGRESS(getUserEntityId(userType)));
      },
      onError: async (e) => {
        message.fatal('Unable to upload file for import. ', e);
        await queryClient.invalidateQueries(FLAT_FILE_PROGRESS(getUserEntityId(userType)));
      },
    },
  );

  const steps = useMemo(() => {
    const steps: Step<StepKey>[] = [];
    steps.push({
      key: 'UPLOAD_FILE',
      title: 'Upload file',
    });
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
              { title: `${firstLetterUpper(settings.userAlias)}s`, to: '/users' },
              {
                title: `${firstLetterUpper(list)} ${settings.userAlias}s`,
                to: `/users/list/${list}`,
              },
              { title: 'Import CSV', to: `/users/list/${list}/import` },
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
            userType={userType}
          />
        )}
        {activeStep === 'DATA_VALIDATION' && (
          <DataValidationStep progressRes={progressRes} userType={userType} />
        )}
      </>
    </PageWrapper>
  );
}

/*
  Helpers
 */
function useProgressResource(
  userType: 'consumer' | 'business',
): AsyncResource<FlatFileProgressResponse> {
  const api = useApi();
  const entityId = getUserEntityId(userType);
  const schema = getUserSchemaType(userType);

  const ongoingImportsProgressQueryResult = useQuery(
    FLAT_FILE_PROGRESS(entityId),
    async () => {
      return await api.getFlatFilesProgress({
        schema,
        entityId,
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
    },
  );
  return ongoingImportsProgressQueryResult.data;
}
