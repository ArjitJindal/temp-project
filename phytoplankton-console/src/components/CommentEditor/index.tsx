import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Upload from 'antd/es/upload/Upload';
import { uniqBy } from 'lodash';
import NarrativeTemplateSelect from '../NarrativeTemplateSelect';
import { useFeatureEnabled } from '../AppWrapper/Providers/SettingsProvider';
import s from './styles.module.less';
import { message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { FileInfo } from '@/apis';
import FilesList from '@/components/files/FilesList';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { AsyncResource, isLoading } from '@/utils/asyncResource';
import { Hint } from '@/components/library/Form/InputField';
import { uploadFile } from '@/utils/file-uploader';
import { useUsers } from '@/utils/user-utils';
import { getErrorMessage } from '@/utils/lang';

export const MAX_COMMENT_LENGTH = 10000;

export interface FormValues {
  comment: string;
  files: FileInfo[];
  parentCommentId?: string;
}

interface Props {
  showFileList?: boolean;
  values: FormValues;
  submitRes: AsyncResource;
  placeholder?: string;
  onChangeValues: (newValues: FormValues) => void;
  onSubmit: (values: FormValues) => void;
  disabled?: boolean;
  submitButtonTitle?: string;
  hideNarrativeTemplateSelect?: boolean;
  editorHeight?: number;
}

export interface CommentEditorRef {
  reset: () => void;
}

let uploadedFiles: FileInfo[] = [];

function CommentEditor(props: Props, ref: React.Ref<CommentEditorRef>) {
  const {
    showFileList = true,
    values,
    submitRes,
    placeholder,
    onChangeValues,
    onSubmit,
    submitButtonTitle = 'Add comment',
    hideNarrativeTemplateSelect = false,
    editorHeight,
  } = props;
  const api = useApi();
  const [uploadingCount, setUploadingCount] = useState(0);
  const [templateValue, setTemplateValue] = useState<string | undefined>(undefined);
  const [users] = useUsers();
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

  const isMentionsEnabled = useFeatureEnabled('NOTIFICATIONS');
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

  useEffect(() => {
    if (templateValue) {
      editorRef.current?.editorRef.current?.getInstance().setMarkdown(templateValue);
      setTemplateValue(undefined);
    }
  }, [templateValue]);

  const isCommentTooLong = values.comment.length > MAX_COMMENT_LENGTH;
  return (
    <div className={s.commentEditor} data-cy="comment-editor">
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
          mentionsEnabled={isMentionsEnabled}
          mentionsList={Object.keys(users).map((userId) => ({
            label: users[userId].email,
            id: users[userId].id,
          }))}
          editorHeight={editorHeight}
        />
      </div>
      {isCommentTooLong && (
        <Hint isError={true}>
          {`This field cannot be longer than ${MAX_COMMENT_LENGTH} characters`}
        </Hint>
      )}
      {showFileList && (
        <FilesList files={values.files} onDeleteFile={removeFile} fixedHeight={true} />
      )}
      <div className={s.commentEditorActions}>
        <Button
          analyticsName={submitButtonTitle}
          htmlType="submit"
          isLoading={isLoading(submitRes) || uploadingCount > 0}
          onClick={() => {
            onSubmit(values);
            setTemplateValue(undefined);
          }}
          type="PRIMARY"
          testName="add-comment-button"
          isDisabled={
            (values.files.length === 0 && !values.comment) || isCommentTooLong || props.disabled
          }
        >
          {submitButtonTitle}
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
            const file = f;

            if (!(file instanceof File)) {
              message.fatal('Failed to upload the file', new Error('Invalid file'));
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
                files: uniqBy([...values.files, ...uploadedFiles], 's3Key'),
              });
              hideMessage();
            } catch (error) {
              message.fatal(`Unable to upload the file. ${getErrorMessage(error)}`, error);
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
        {!hideNarrativeTemplateSelect && (
          <NarrativeTemplateSelect
            setTemplateValue={setTemplateValue}
            templateValue={templateValue}
          />
        )}
      </div>
    </div>
  );
}

export default React.forwardRef(CommentEditor);
