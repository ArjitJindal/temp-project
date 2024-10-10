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
import { LISTS_ITEM } from '@/utils/queries/keys';
import { P } from '@/components/ui/Typography';
import Alert from '@/components/library/Alert';

interface Props {
  listId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportCsvModal(props: Props) {
  const { listId, isOpen, onClose } = props;
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
        return await api.listImportCsv({
          listId: listId,
          InlineObject: {
            file: file,
          },
        });
      } finally {
        closeLoading();
      }
    },
    {
      onSuccess: async (result: ListImportResponse) => {
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
        await queryClient.invalidateQueries(LISTS_ITEM(listId));
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
          onChange={(files) => {
            setFiles(files);
            setErrors(undefined);
          }}
          singleFile={true}
        />
        <P grey={true} variant={'s'}>
          Provided CSV file should not contain header. Each row should contain at least one value
          (item key) and, optionally, second value - the reason of adding to the list. If record
          with specified key already exist in the list, it will be overwritten.
        </P>
        {errors?.map((error) => (
          <Alert type={'error'} key={error.lineNumber}>
            Line {error.lineNumber}: {error.reason}
          </Alert>
        ))}
      </div>
    </Modal>
  );
}
