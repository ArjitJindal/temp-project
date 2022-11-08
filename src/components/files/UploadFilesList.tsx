import { message, Upload } from 'antd';
import filesize from 'filesize';
import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import axios from 'axios';
import { UploadOutlined } from '@ant-design/icons';
import Button from '../ui/Button';
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
  const [files, setFiles] = useState<FileInfo[]>(props.files);
  const removeFile = useCallback(
    (s3Key) => setFiles((prevFiles) => prevFiles.filter((file) => file.s3Key !== s3Key)),
    [],
  );

  useImperativeHandle(ref, () => ({
    removeAllFiles: () => {
      setFiles([]);
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
          removeFile(file.uid);
          await props.onFileRemoved(file.uid);
        } catch (error) {
          message.error('Failed to remove the file');
        }
      }}
      customRequest={async ({ file: f, onError, onSuccess }) => {
        const file = f as File;
        const hideMessage = message.loading('Uploading...', 0);
        let fileS3Key = '';
        try {
          // 1. Get S3 presigned URL
          const { presignedUrl, s3Key } = await api.postGetPresignedUrl({});
          fileS3Key = s3Key;

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
          setFiles((prevFiles) => [...prevFiles, fileInfo]);
          await props.onFileUploaded(fileInfo);
          hideMessage();
        } catch (error) {
          message.error('Failed to upload the file');
          if (onError) {
            onError(new Error());
            removeFile(fileS3Key);
          }
        } finally {
          hideMessage && hideMessage();
        }
      }}
    >
      {!props.disableUpload && (
        <Button analyticsName="Attach files" size="small" icon={<UploadOutlined />}>
          Upload
        </Button>
      )}
    </Upload>
  );
});
