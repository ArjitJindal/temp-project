import { Upload } from 'antd';
import cn from 'clsx';
import { useEffect, useState } from 'react';
import mime from 'mime';
import s from './index.module.less';
import { InputProps } from '@/components/library/Form';
import { FileInfo } from '@/apis';
import { message } from '@/components/library/Message';
import { uploadFile } from '@/utils/file-uploader';
import { useApi } from '@/api';
import FilesList from '@/components/files/FilesList';
import { usePrevious } from '@/utils/hooks';
import { getErrorMessage, isEqual } from '@/utils/lang';
import UploadIcon from '@/components/ui/icons/Remix/system/upload-2-line.react.svg';
import { notEmpty } from '@/utils/array';

const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

interface Props extends InputProps<FileInfo[]> {
  singleFile?: boolean;
  size?: 'SMALL' | 'LARGE';
  info?: string;
  listType?: 'comment' | 'attachment';
  setUploading?: (uploading: boolean) => void;
  required?: boolean;
  accept?: string[]; // file mime types to accept, e.g. ["image/jpeg", "image/png", "application/pdf"]
  onShowErrorMessages?: (errors: string[]) => void;
}

export default function FilesDraggerInput(props: Props) {
  const {
    value,
    onChange,
    singleFile,
    size = 'SMALL',
    listType = 'comment',
    required = false,
    setUploading,
    accept = DEFAULT_ALLOWED_TYPES,
    onShowErrorMessages,
    isDisabled,
  } = props;
  const acceptExtensions = accept.map((mimetype) => mime.getExtension(mimetype)).filter(notEmpty);
  const info =
    props.info ??
    'Supported file types: ' + acceptExtensions.map((x) => x.toUpperCase()).join(', ');
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
        disabled={uploadingCount > 0 || isDisabled}
        multiple={!singleFile}
        showUploadList={false}
        accept={acceptExtensions.map((extension) => '.' + extension).join(',')}
        customRequest={async ({ file: f, onError, onSuccess }) => {
          setUploadingCount((count) => count + 1);
          setUploading?.(true);
          const file = f as File;
          const hideMessage = message.loading('Uploading...');
          try {
            if (accept) {
              if (!file.type || !accept.includes(file.type)) {
                const errorMessage = `File type not allowed. Accepted types: ${acceptExtensions
                  .map((x) => x.toUpperCase())
                  .join(', ')}`;
                if (onShowErrorMessages) {
                  onShowErrorMessages([errorMessage]);
                } else {
                  message.error(errorMessage);
                }
                return;
              }
            }

            if (listType === 'attachment') {
              if (!DEFAULT_ALLOWED_TYPES.includes(file.type)) {
                message.error('Unsupported file type');
                return;
              }
            }

            const { s3Key } = await uploadFile(api, file);
            if (onSuccess) {
              onSuccess(s3Key);
            }
            const fileInfo = { s3Key, filename: file.name, size: file.size };
            setState((prevState) => (singleFile ? [fileInfo] : [...(prevState ?? []), fileInfo]));
            hideMessage();
          } catch (error) {
            const errorMessage = `${getErrorMessage(error)}`;
            if (onShowErrorMessages) {
              onShowErrorMessages([errorMessage]);
            } else {
              message.fatal(errorMessage, error);
            }
            if (onError) {
              onError(new Error());
            }
          } finally {
            hideMessage && hideMessage();
            setUploadingCount((count) => count - 1);
            setUploading?.(false);
          }
        }}
      >
        <div className={cn(s.textRoot, size === 'SMALL' ? s.small : s.large)}>
          <UploadIcon className={s.icon} />
          <div className={cn(s.title, size === 'SMALL' ? s.alignItemsStart : '')}>
            <div className={s.title1}>
              Click or drag file to this area to upload
              {required && <span className={s.required}> *</span>}
            </div>
            <div className={cn(s.title2, size === 'SMALL' ? s.textAlignStart : '')}>{info}</div>
          </div>
        </div>
      </Upload.Dragger>

      <FilesList
        disableMissingLinks={false}
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
