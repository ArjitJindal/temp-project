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

interface Props {
  caseId: string;
  onCommentAdded: (comment: TransactionComment) => void;
  showFileList?: boolean;
}

function CommentEditor({ caseId, onCommentAdded, showFileList = false }: Props) {
  const api = useApi();
  const [commentValue, setCommentValue] = useState('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const removeFile = useCallback(
    (s3Key) => setFiles((prevFiles) => prevFiles.filter((file) => file.s3Key !== s3Key)),
    [],
  );

  const submitComment = useCallback(async () => {
    setLoading(true);
    try {
      const comment = await api.postCaseComments({
        caseId,
        Comment: {
          body: commentValue,
          files,
        },
      });
      onCommentAdded(comment);
      setCommentValue('');
      setFiles([]);
    } catch (err) {
      message.error('Failed to add comment');
    } finally {
      setLoading(false);
    }
  }, [api, commentValue, files, onCommentAdded, caseId]);

  return (
    <div className={s.commentEditor}>
      <Row gutter={[0, 16]} align="middle" justify="space-between">
        <Col flex="row" className={s.commentEditorInput}>
          <Input.TextArea
            rows={2}
            onChange={(event) => setCommentValue(event.target.value)}
            value={commentValue}
          />
        </Col>
        <div className={s.commentEditorActions}>
          <Col style={{ padding: '0 1rem' }}>
            <Upload
              multiple={true}
              fileList={
                !showFileList ? files.map((file) => ({ uid: file.s3Key, name: file.filename })) : []
              }
              onRemove={(file) =>
                setFiles((prevFiles) => prevFiles.filter((f) => f.s3Key !== file.uid))
              }
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
                  setFiles((prevFiles) => [
                    ...prevFiles,
                    { s3Key, filename: file.name, size: file.size },
                  ]);
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
              disabled={files.length === 0 && !commentValue}
            >
              Add Comment
            </Button>
          </Col>
        </div>
      </Row>
      {showFileList && (
        <Row style={{ marginTop: '1rem' }}>
          <FilesList
            files={files}
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
