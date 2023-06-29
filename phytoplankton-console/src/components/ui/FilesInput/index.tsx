import React, { useState } from 'react';
import _ from 'lodash';
import { InputProps } from '@/components/library/Form';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { FileInfo } from '@/apis';

export interface RemoveAllFilesRef {
  removeAllFiles: () => void;
}

interface Props extends InputProps<FileInfo[]> {}

function FilesInput(props: Props, ref: React.Ref<RemoveAllFilesRef>) {
  const { value = [], onChange } = props;
  const [uploadingCount, setUploadingCount] = useState(0);
  return (
    <UploadFilesList
      files={value}
      onFileUploaded={async (file) => {
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
