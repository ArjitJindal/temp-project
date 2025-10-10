import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import { FileInfo, ListImportResponse } from '@/apis';
import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { isLoading } from '@/utils/asyncResource';
import { LISTS_ITEM, FLAT_FILE_PROGRESS } from '@/utils/queries/keys';
import { P } from '@/components/ui/Typography';
import Alert from '@/components/library/Alert';

interface Props {
  listId: string;
  isOpen: boolean;
  onClose: () => void;
  listType: 'WHITELIST' | 'BLACKLIST';
  isCustomList: boolean;
  setIsFlatFileProgressLoading: (isLoading: boolean) => void;
}

export default function ImportCsvModal(props: Props) {
  const { listId, isOpen, onClose, listType, isCustomList, setIsFlatFileProgressLoading } = props;
  const [files, setFiles] = useState<FileInfo[]>();
  const [errors, setErrors] = useState<ListImportResponse['failedRows']>();
  const file = files?.[0];

  const api = useApi();
  const queryClient = useQueryClient();

  const mutation = useMutation<ListImportResponse, void, { file?: FileInfo }>(
    async (variables) => {
      setErrors(undefined);
      const closeLoading = message.loading('Importing file to the list');
      try {
        const { file } = variables;
        if (file == null) {
          throw new Error(`File is not selected`);
        }
        if (listType === 'WHITELIST') {
          return await api.whiteListImportCsv({
            listId: listId,
            InlineObject: { file },
          });
        }
        return await api.blacklistImportCsv({
          listId: listId,
          InlineObject1: { file },
        });
      } finally {
        closeLoading();
      }
    },
    {
      onSuccess: async (result: ListImportResponse) => {
        if (isCustomList) {
          // In case we show the initialising upload message, because we wait for the job to be created,
          // Thus we need have added the delay of 5 secs, so that we do not fetch the data of previous file upload and give room for the new batch job to be created after file upload
          setIsFlatFileProgressLoading(true);
          setTimeout(() => {
            queryClient.invalidateQueries(FLAT_FILE_PROGRESS(listId));
          }, 5000);
          return;
        }
        await queryClient.invalidateQueries(LISTS_ITEM(listId));
        if (result.failedRows.length > 0) {
          message.warn(
            `${result.failedRows.length} of ${result.totalRows} items weren't imported because of errors!`,
          );
          setErrors(result.failedRows);
        } else {
          if (result.successRows === result.totalRows) {
            message.success(`${result.totalRows} items imported successfully`);
          } else {
            message.success(`Imported ${result.successRows} or ${result.totalRows} items!`);
          }
          onClose();
          setFiles(undefined);
        }
      },
      onError: async (err) => {
        message.error(`Unable to upload a file! ${getErrorMessage(err)}`);
      },
    },
  );

  return (
    <Modal
      title={'Import items from CSV file'}
      isOpen={isOpen}
      onCancel={onClose}
      okProps={{
        isLoading: isLoading(mutation.dataResource),
        isDisabled: file == null,
      }}
      cancelProps={{
        isDisabled: isLoading(mutation.dataResource),
      }}
      maskClosable={!isLoading(mutation.dataResource)}
      onOk={() => {
        if (file != null) {
          mutation.mutate({
            file,
          });
        }
      }}
    >
      <div className={s.root}>
        <FilesDraggerInput
          value={files}
          onChange={(newFiles) => {
            setFiles(newFiles?.length ? [newFiles[newFiles.length - 1]] : newFiles);
            setErrors(undefined);
          }}
          singleFile={true}
          accept={['text/csv']}
        />
        <P grey={true} variant={'s'}>
          {`Provided CSV file should ${
            isCustomList ? 'contain' : 'not contain'
          } header. Each row should contain at least one value
          (item key) and, optionally, second value - the reason of adding to the list. If record
          with specified key already exist in the list, it will be overwritten.`}
        </P>
        {errors?.map((error) => (
          <Alert type={'ERROR'} key={error.lineNumber}>
            Line {error.lineNumber}: {error.reason}
          </Alert>
        ))}
      </div>
    </Modal>
  );
}
