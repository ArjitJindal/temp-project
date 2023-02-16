import { message, Upload } from 'antd';
import filesize from 'filesize';
import React, { forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { UploadOutlined } from '@ant-design/icons';
import Button from '../library/Button';
import { FileInfo } from '@/apis';
import { useApi } from '@/api';

interface Props {
  files: FileInfo[];
  disableUpload?: boolean;
  onFileUploaded: (file: FileInfo) => Promise<void>;
  onFileRemoved: (s3Key: string) => Promise<void>;
}

interface RemoveAllFilesRef {
  removeAllFiles: () => void;
}

export const UploadFilesList = forwardRef((props: Props, ref: React.Ref<RemoveAllFilesRef>) => {
  const api = useApi();
  const { files, onFileUploaded, onFileRemoved } = props;

  useImperativeHandle(ref, () => ({
    removeAllFiles: async () => {
      await Promise.all(files.map((file) => onFileRemoved(file.s3Key)));
    },
  }));

  return (
    <Upload
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
        const file = f as File;
        const hideMessage = message.loading('Uploading...');
        try {
          // 1. Get S3 presigned URL
          const { presignedUrl, s3Key } = await api.postGetPresignedUrl({});

          // 2. Upload file to S3 directly
          await axios.put(presignedUrl, file, {
            headers: {
              'Content-Disposition': `attachment; filename="${file.name}"`,
            },
          });
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
