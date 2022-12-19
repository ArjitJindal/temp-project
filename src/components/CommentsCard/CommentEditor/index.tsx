import { Col, Input, message, Row } from 'antd';
import React, { useCallback, useState } from 'react';
import Upload from 'antd/es/upload/Upload';
import axios from 'axios';
import { PaperClipOutlined } from '@ant-design/icons';
import s from './styles.module.less';
import Button from '@/components/ui/Button';
import { useApi } from '@/api';
import { Comment as TransactionComment, FileInfo } from '@/apis';
import { FilesList } from '@/components/files/FilesList';

export interface FormValues {
  comment: string;
  files: FileInfo[];
}

interface Props {
  id: string;
  onCommentAdded: (comment: TransactionComment) => void;
  showFileList?: boolean;
  commentType: 'CASE' | 'USER';
  values: FormValues;
  onChangeValues: (newValues: FormValues) => void;
}

function CommentEditor(props: Props) {
  const { id, onCommentAdded, showFileList = false, commentType, values, onChangeValues } = props;
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const removeFile = useCallback(
    (s3Key) =>
      onChangeValues({
        ...values,
        files: values.files.filter((file) => file.s3Key !== s3Key),
      }),
    [values, onChangeValues],
  );

  const submitComment = useCallback(async () => {
    setLoading(true);
    try {
      let comment;
      const commentData = { Comment: { body: values.comment, files: values.files } };
      if (commentType === 'CASE') {
        comment = await api.postCaseComments({
          caseId: id,
          ...commentData,
        });
      } else {
        comment = await api.postUserComments({
          userId: id,
          ...commentData,
        });
      }
      onCommentAdded(comment);
      onChangeValues({
        comment: '',
        files: [],
      });
    } catch (err) {
      message.error('Failed to add comment');
    } finally {
      setLoading(false);
    }
  }, [commentType, onCommentAdded, api, id, values, onChangeValues]);

  return (
    <div className={s.commentEditor}>
      <Row gutter={[0, 16]} align="middle" justify="space-between">
        <Col flex="row" className={s.commentEditorInput}>
          <Input.TextArea
            rows={2}
            onChange={(event) => onChangeValues({ ...values, comment: event.target.value })}
            value={values.comment}
          />
        </Col>
        <div className={s.commentEditorActions}>
          <Col
            style={{
              paddingTop: '0rem',
              paddingBottom: '0rem',
              paddingLeft: '1rem',
              paddingRight: '1rem',
            }}
          >
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
                setLoading(true);
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
                  onChangeValues({
                    ...values,
                    files: [...values.files, { s3Key, filename: file.name, size: file.size }],
                  });
                  hideMessage();
                } catch (error) {
                  message.error('Failed to upload the file');
                  if (onError) {
                    onError(new Error());
                    removeFile(fileS3Key);
                  }
                } finally {
                  hideMessage && hideMessage();
                  setLoading(false);
                }
              }}
            >
              <Button analyticsName="Attach files" size="middle" icon={<PaperClipOutlined />}>
                Attach files
              </Button>
            </Upload>
          </Col>
          <Col>
            <Button
              analyticsName="Add Comment"
              htmlType="submit"
              loading={loading}
              onClick={submitComment}
              type="primary"
              disabled={values.files.length === 0 && !values.comment}
            >
              Add Comment
            </Button>
          </Col>
        </div>
      </Row>
      {showFileList && (
        <Row style={{ marginTop: '1rem' }}>
          <FilesList
            files={values.files}
            showGreyBackground={true}
            removeFile={removeFile}
            showDeleteButton={true}
          />
        </Row>
      )}
    </div>
  );
}

export default CommentEditor;
