import React from 'react';
import _ from 'lodash';
import { InputProps } from '@/components/library/Form';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { FileInfo } from '@/apis';

export interface RemoveAllFilesRef {
  removeAllFiles: () => void;
}

interface Props extends InputProps<FileInfo[]> {
  uploadingCount: number;
  setUploadingCount: React.Dispatch<React.SetStateAction<number>>;
  uploadedFiles: FileInfo[];
}

function FilesInput(props: Props, ref: React.Ref<RemoveAllFilesRef>) {
  const { value = [], onChange, uploadingCount, setUploadingCount, uploadedFiles } = props;
  return (
    <UploadFilesList
      files={value}
      onFileUploaded={async (file) => {
        uploadedFiles.push(file);
        onChange?.(_.uniqBy([...value, file], 's3Key'));
      }}
      onFileRemoved={async (fileS3Key) => {
        onChange?.(value.filter((prevFile) => prevFile.s3Key !== fileS3Key));
      }}
      uploadingCount={uploadingCount}
      setUploadingCount={setUploadingCount}
      ref={ref}
    />
  );
}

export default React.forwardRef(FilesInput);
