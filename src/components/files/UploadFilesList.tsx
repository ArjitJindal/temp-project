import { message, Upload } from 'antd';
import filesize from 'filesize';
import React, { forwardRef, useImperativeHandle } from 'react';
import { UploadOutlined } from '@ant-design/icons';
import Button from '../library/Button';
import { FileInfo } from '@/apis';
import { useApi } from '@/api';
import { uploadFile } from '@/utils/file-uploader';

interface Props {
  files: FileInfo[];
  disableUpload?: boolean;
  onFileUploaded: (file: FileInfo) => Promise<void>;
  onFileRemoved: (s3Key: string) => Promise<void>;
  uploadingCount: number;
  setUploadingCount: React.Dispatch<React.SetStateAction<number>>;
}

interface RemoveAllFilesRef {
  removeAllFiles: () => void;
}

export const UploadFilesList = forwardRef((props: Props, ref: React.Ref<RemoveAllFilesRef>) => {
  const api = useApi();
  const { files, onFileUploaded, onFileRemoved, uploadingCount, setUploadingCount } = props;

  useImperativeHandle(ref, () => ({
    removeAllFiles: async () => {
      await Promise.all(files.map((file) => onFileRemoved(file.s3Key)));
    },
  }));

  return (
    <Upload
      disabled={uploadingCount > 0}
      multiple={true}
      fileList={files.map((file) => ({
        uid: file.s3Key,
        name: `${file.filename} (${filesize(file.size)})`,
        url: file.downloadLink,
      }))}
      onRemove={async (file) => {
        try {
          await props.onFileRemoved(file.uid);
        } catch (error) {
          message.error('Failed to remove the file');
        }
      }}
      customRequest={async ({ file: f, onError, onSuccess }) => {
        setUploadingCount((count) => count + 1);
        const file = f as File;
        const hideMessage = message.loading('Uploading...');
        try {
          const { s3Key } = await uploadFile(api, file);
          if (onSuccess) {
            onSuccess(s3Key);
          }
          const fileInfo = { s3Key, filename: file.name, size: file.size };
          await onFileUploaded(fileInfo);
          hideMessage();
        } catch (error) {
          message.error('Failed to upload the file');
          if (onError) {
            onError(new Error());
          }
        } finally {
          hideMessage && hideMessage();
          setUploadingCount((count) => count - 1);
        }
      }}
    >
      {!props.disableUpload && (
        <Button analyticsName="Attach files" size="SMALL" icon={<UploadOutlined />}>
          Upload
        </Button>
      )}
    </Upload>
  );
});
