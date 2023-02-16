import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import Upload from 'antd/es/upload/Upload';
import axios from 'axios';
import s from './styles.module.less';
import { message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { FileInfo } from '@/apis';
import { FilesList } from '@/components/files/FilesList';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { AsyncResource, isLoading } from '@/utils/asyncResource';

export interface FormValues {
  comment: string;
  files: FileInfo[];
}

interface Props {
  showFileList?: boolean;
  values: FormValues;
  submitRes: AsyncResource;
  onChangeValues: (newValues: FormValues) => void;
  onSubmit: () => void;
}

export interface CommentEditorRef {
  reset: () => void;
}

function CommentEditor(props: Props, ref: React.Ref<CommentEditorRef>) {
  const { showFileList = true, values, submitRes, onChangeValues, onSubmit } = props;
  const api = useApi();
  const [isUploadLoading, setUploadLoading] = useState(false);
  const removeFile = useCallback(
    (s3Key) =>
      onChangeValues({
        ...values,
        files: values.files.filter((file) => file.s3Key !== s3Key),
      }),
    [values, onChangeValues],
  );

  const editorRef = useRef<MarkdownEditor>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      editorRef.current?.reset();
    },
  }));

  return (
    <div className={s.commentEditor}>
      <div className={s.commentEditorInput}>
        <MarkdownEditor
          ref={editorRef}
          initialValue={values.comment}
          onChange={(value) => {
            onChangeValues({ ...values, comment: value });
          }}
          onAttachFiles={() => {
            if (uploadRef.current) {
              uploadRef.current.click();
            }
          }}
        />
      </div>
      {showFileList && (
        <FilesList
          files={values.files}
          showGreyBackground={true}
          removeFile={removeFile}
          showDeleteButton={true}
        />
      )}
      <div className={s.commentEditorActions}>
        <Button
          analyticsName="Add Comment"
          htmlType="submit"
          isLoading={isLoading(submitRes) || isUploadLoading}
          onClick={onSubmit}
          type="PRIMARY"
          isDisabled={values.files.length === 0 && !values.comment}
        >
          Add Comment
        </Button>
        <Upload
          multiple={true}
          fileList={
            !showFileList
              ? values.files.map((file) => ({ uid: file.s3Key, name: file.filename }))
              : []
          }
          onRemove={(file) => {
            onChangeValues({
              ...values,
              files: values.files.filter((f) => f.s3Key !== file.uid),
            });
          }}
          customRequest={async ({ file: f, onError, onSuccess }) => {
            const file = f as File;
            if (process.env.ENV_NAME === 'local') {
              onChangeValues({
                ...values,
                files: [
                  ...values.files,
                  {
                    s3Key: `fake-s3-key-${Date.now()}`,
                    bucket: 'fake-bucket-name',
                    filename: file.name,
                    size: file.size,
                    downloadLink: `https://example.com/fake-download-url/${Date.now()}`,
                  },
                ],
              });
              return;
            }
            setUploadLoading(true);
            const hideMessage = message.loading('Uploading...');
            let fileS3Key = '';
            try {
              // 1. Get S3 presigned URL
              const { presignedUrl, s3Key } = await api.postGetPresignedUrl({});
              fileS3Key = s3Key;

              // 2. Upload file to S3 directly
              await axios.put(presignedUrl, file, {
                headers: {
                  'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
                },
              });
              if (onSuccess) {
                onSuccess(s3Key);
              }
              onChangeValues({
                ...values,
                files: [...values.files, { s3Key, filename: file.name, size: file.size }],
              });
              hideMessage();
            } catch (error) {
              console.error(error);
              message.error('Failed to upload the file');
              if (onError) {
                onError(new Error());
                removeFile(fileS3Key);
              }
            } finally {
              hideMessage && hideMessage();
              setUploadLoading(false);
            }
          }}
        >
          <div className={s.uploadButton}>
            <Button
              ref={uploadRef}
              analyticsName="Attach files"
              size="MEDIUM"
              isLoading={isUploadLoading}
              isDisabled={isLoading(submitRes)}
            />
          </div>
        </Upload>
      </div>
    </div>
  );
}

export default React.forwardRef(CommentEditor);
