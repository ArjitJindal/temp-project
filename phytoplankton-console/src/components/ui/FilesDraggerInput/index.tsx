import { Upload } from 'antd';
import { useEffect, useState } from 'react';
import s from './index.module.less';
import Icon from './icon.react.svg';
import { InputProps } from '@/components/library/Form';
import { FileInfo } from '@/apis';
import { message } from '@/components/library/Message';
import { uploadFile } from '@/utils/file-uploader';
import { useApi } from '@/api';
import FilesList from '@/components/files/FilesList';
import { usePrevious } from '@/utils/hooks';
import { isEqual } from '@/utils/lang';

interface Props extends InputProps<FileInfo[]> {}

export default function FilesDraggerInput(props: Props) {
  const { value, onChange } = props;
  const [uploadingCount, setUploadingCount] = useState(0);
  const api = useApi();

  const [state, setState] = useState(value);

  const prevValue = usePrevious(value);
  useEffect(() => {
    if (!isEqual(prevValue, value)) {
      setState(value);
    }
  }, [prevValue, value]);

  const prevState = usePrevious(state);
  useEffect(() => {
    if (!isEqual(prevState, state)) {
      onChange?.(state);
    }
  }, [onChange, prevState, state]);

  return (
    <div className={s.root}>
      <Upload.Dragger
        disabled={uploadingCount > 0}
        multiple={true}
        showUploadList={false}
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
            setState((prevState) => [...(prevState ?? []), fileInfo]);
            hideMessage();
          } catch (error) {
            message.fatal('Failed to upload the file', error);
            if (onError) {
              onError(new Error());
            }
          } finally {
            hideMessage && hideMessage();
            setUploadingCount((count) => count - 1);
          }
        }}
      >
        <div className={s.textRoot}>
          <Icon className={s.icon} />
          <div className={s.title1}>Click or drag file to this area to upload</div>
          <div className={s.title2}>
            Support for a single or bulk upload. Strictly prohibit from uploading company data or
            other related files.
          </div>
        </div>
      </Upload.Dragger>
      <FilesList
        files={state ?? []}
        onDeleteFile={
          onChange
            ? (s3Key) => {
                setState((prevState) => (prevState ?? []).filter((x) => x.s3Key !== s3Key));
              }
            : undefined
        }
      />
    </div>
  );
}
