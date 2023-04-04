import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Upload from 'antd/es/upload/Upload';
import _ from 'lodash';
import s from './styles.module.less';
import { message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { FileInfo } from '@/apis';
import { FilesList } from '@/components/files/FilesList';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { AsyncResource, isLoading } from '@/utils/asyncResource';
import { Hint } from '@/components/library/Form/InputField';
import { uploadFile } from '@/utils/file-uploader';

export const MAX_COMMENT_LENGTH = 5000;

export interface FormValues {
  comment: string;
  files: FileInfo[];
}

interface Props {
  showFileList?: boolean;
  values: FormValues;
  submitRes: AsyncResource;
  placeholder?: string;
  onChangeValues: (newValues: FormValues) => void;
  onSubmit: (values: FormValues) => void;
  disabled?: boolean;
}

export interface CommentEditorRef {
  reset: () => void;
}

let uploadedFiles: FileInfo[] = [];

function CommentEditor(props: Props, ref: React.Ref<CommentEditorRef>) {
  const { showFileList = true, values, submitRes, placeholder, onChangeValues, onSubmit } = props;
  const api = useApi();
  const [uploadingCount, setUploadingCount] = useState(0);
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

  useEffect(() => {
    if (uploadingCount === 0) {
      uploadedFiles = [];
    }
  }, [uploadingCount]);

  const isCommentTooLong = values.comment.length > MAX_COMMENT_LENGTH;
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
          placeholder={placeholder}
        />
      </div>
      {isCommentTooLong && (
        <Hint isError={true}>
          {`This field cannot be longer than ${MAX_COMMENT_LENGTH} characters`}
        </Hint>
      )}
      {showFileList && (
        <FilesList
          files={values.files}
          showGreyBackground={true}
          removeFile={removeFile}
          showDeleteButton={true}
          fixedHeight={true}
        />
      )}
      <div className={s.commentEditorActions}>
        <Button
          analyticsName="Add Comment"
          htmlType="submit"
          isLoading={isLoading(submitRes) || uploadingCount > 0}
          onClick={() => onSubmit(values)}
          type="PRIMARY"
          isDisabled={
            (values.files.length === 0 && !values.comment) || isCommentTooLong || props.disabled
          }
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
              uploadedFiles.push({
                s3Key: `fake-s3-key-${Date.now()}`,
                bucket: 'fake-bucket-name',
                filename: file.name,
                size: file.size,
                downloadLink: `https://example.com/fake-download-url/${Date.now()}`,
              });
              onChangeValues({
                ...values,
                files: [...values.files, ...uploadedFiles],
              });
              return;
            }
            setUploadingCount((prevCount) => prevCount + 1);
            const hideMessage = message.loading('Uploading...');
            let fileS3Key = '';
            try {
              const { s3Key } = await uploadFile(api, file);
              fileS3Key = s3Key;
              if (onSuccess) {
                onSuccess(s3Key);
              }
              uploadedFiles.push({ s3Key, filename: file.name, size: file.size });
              onChangeValues({
                ...values,
                files: _.uniqBy([...values.files, ...uploadedFiles], 's3Key'),
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
              setUploadingCount((prevCount) => prevCount - 1);
            }
          }}
        >
          <div className={s.uploadButton}>
            <Button
              ref={uploadRef}
              analyticsName="Attach files"
              size="MEDIUM"
              isLoading={uploadingCount > 0}
              isDisabled={isLoading(submitRes) || props.disabled}
            />
          </div>
        </Upload>
      </div>
    </div>
  );
}

export default React.forwardRef(CommentEditor);
