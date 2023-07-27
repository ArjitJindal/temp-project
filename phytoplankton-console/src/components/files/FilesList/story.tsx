import React from 'react';
import FilesList from './index';
import { UseCase } from '@/pages/storybook/components';
import { FileInfo } from '@/apis';

export default function (): JSX.Element {
  const files = [
    {
      s3Key: 's3Key',
      bucket: 'bucket',
      filename: 'Short filename.mp3',
      size: 48120,
      downloadLink: 'downloadLink',
    },
    {
      s3Key: 's3Key2',
      bucket: 'bucket2',
      filename:
        'This can be a very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very long name.txt',
      size: 82717200,
      downloadLink: 'downloadLink2',
    },
    {
      s3Key: 's3Key3',
      bucket: 'bucket3',
      filename: 'Medium size file name here, just a little longer.txt',
      size: 2874,
      downloadLink: 'downloadLink3',
    },
  ];
  return (
    <>
      <UseCase title="Basic case">
        <FilesList files={files} />
      </UseCase>
      <UseCase title="Delete support" initialState={{ files }}>
        {([state, setState]) => (
          <FilesList
            files={state.files ?? []}
            onDeleteFile={(s3Key) => {
              setState((prevState) => ({
                ...prevState,
                files: prevState.files?.filter((x: FileInfo) => x.s3Key !== s3Key),
              }));
            }}
          />
        )}
      </UseCase>
    </>
  );
}
