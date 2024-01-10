import { Upload } from 'antd';
import cn from 'clsx';
import { useEffect, useState } from 'react';
import s from './index.module.less';
import { InputProps } from '@/components/library/Form';
import { FileInfo } from '@/apis';
import { message } from '@/components/library/Message';
import { uploadFile } from '@/utils/file-uploader';
import { useApi } from '@/api';
import FilesList from '@/components/files/FilesList';
import { usePrevious } from '@/utils/hooks';
import { isEqual } from '@/utils/lang';
import UploadIcon from '@/components/ui/icons/Remix/system/upload-2-line.react.svg';
import Label from '@/components/library/Label';

interface Props extends InputProps<FileInfo[]> {
  singleFile?: boolean;
  size?: 'SMALL' | 'LARGE';
  hideLabel?: boolean;
}

export default function FilesDraggerInput(props: Props) {
  const { value, onChange, singleFile, size = 'SMALL', hideLabel } = props;
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
      {!hideLabel && <Label label={'Upload attachments'} />}
      <Upload.Dragger
        disabled={uploadingCount > 0}
        multiple={!singleFile}
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
        <div className={cn(s.textRoot, size === 'SMALL' ? s.small : s.large)}>
          <UploadIcon className={s.icon} />
          <div className={cn(s.title, size === 'SMALL' ? s.alignItemsStart : '')}>
            <div className={s.title1}>Click or drag file to this area to upload</div>
            <div className={cn(s.title2, size === 'SMALL' ? s.textAlignStart : '')}>
              Support for a single or bulk upload. Strictly prohibit from uploading company data or
              other related files.
            </div>
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
