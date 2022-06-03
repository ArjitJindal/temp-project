/* eslint-disable @typescript-eslint/no-var-requires */
import ProDescriptions from '@ant-design/pro-descriptions';
import { Button, Col, Divider, Input, message, Row, Tag, Upload } from 'antd';
import { useCallback, useState } from 'react';
import { PaperClipOutlined } from '@ant-design/icons';
import axios from 'axios';
import styles from './TransactionDetails.less';
import {
  Comment as TransactionComment,
  FileInfo,
  Tag as TransactionTag,
  TransactionCaseManagement,
} from '@/apis';
import { useApi } from '@/api';

interface Props {
  transaction: TransactionCaseManagement;
}

interface CommentEditorProps {
  transactionId: string;
  onCommentAdded: (comment: TransactionComment) => void;
}

const CommentEditor: React.FC<CommentEditorProps> = ({ transactionId, onCommentAdded }) => {
  const api = useApi();
  const [commentValue, setCommentValue] = useState('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const removeFile = useCallback(
    (s3Key) => setFiles((prevFiles) => prevFiles.filter((file) => file !== s3Key)),
    [],
  );
  const submitComment = useCallback(async () => {
    setLoading(true);
    try {
      const comment = await api.postTransactionsComments({
        transactionId,
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
  }, [api, commentValue, files, onCommentAdded, transactionId]);

  return (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <Input.TextArea
          rows={4}
          onChange={(event) => setCommentValue(event.target.value)}
          value={commentValue}
        />
      </Col>
      <Col span={24}>
        <Upload
          multiple={true}
          fileList={files.map((file) => ({ uid: file.s3Key, name: file.filename }))}
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
          <Button size="small" icon={<PaperClipOutlined />}>
            Attach files
          </Button>
        </Upload>
      </Col>
      <Col span={24}>
        <Button
          htmlType="submit"
          loading={loading}
          onClick={submitComment}
          type="primary"
          disabled={files.length === 0 && !commentValue}
        >
          Add Comment
        </Button>
      </Col>
    </Row>
  );
};

export const TransactionDetails: React.FC<Props> = ({ transaction }) => {
  return (
    <>
      <ProDescriptions size="small" column={1} colon={false}>
        <ProDescriptions.Item label={<b>Transaction ID:</b>} valueType="text">
          {transaction.transactionId}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Timestamp:</b>} valueType="dateTime">
          {transaction.timestamp}
        </ProDescriptions.Item>
        <ProDescriptions.Item
          label={
            <Divider orientation="left" orientationMargin="0">
              Origin
            </Divider>
          }
          className={styles.verticalDetailsItem}
        >
          <ProDescriptions size="small" column={1}>
            <ProDescriptions.Item label="User ID" valueType="text">
              {transaction.originUserId}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Amount" valueType="text">
              {transaction.originAmountDetails?.transactionAmount}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Currency" valueType="text">
              {transaction.originAmountDetails?.transactionCurrency}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Country" valueType="text">
              {transaction.originAmountDetails?.country}
            </ProDescriptions.Item>
            <ProDescriptions.Item
              label="Payment Details"
              valueType="jsonCode"
              className={styles.verticalDetailsItem}
            >
              {JSON.stringify(transaction.originPaymentDetails)}
            </ProDescriptions.Item>
          </ProDescriptions>
        </ProDescriptions.Item>
        <ProDescriptions.Item
          label={
            <Divider orientation="left" orientationMargin="0">
              Destination
            </Divider>
          }
          className={styles.verticalDetailsItem}
        >
          <ProDescriptions size="small" column={1}>
            <ProDescriptions.Item label="User ID" valueType="text">
              {transaction.destinationUserId}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Amount" valueType="text">
              {transaction.destinationAmountDetails?.transactionAmount}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Currency" valueType="text">
              {transaction.destinationAmountDetails?.transactionCurrency}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Country" valueType="text">
              {transaction.destinationAmountDetails?.country}
            </ProDescriptions.Item>
            <ProDescriptions.Item
              label="Payment Details"
              valueType="jsonCode"
              className={styles.verticalDetailsItem}
            >
              {JSON.stringify(transaction.destinationPaymentDetails)}
            </ProDescriptions.Item>
          </ProDescriptions>
        </ProDescriptions.Item>
        <ProDescriptions.Item
          label={
            <Divider orientation="left" orientationMargin="0">
              Metadata
            </Divider>
          }
          className={styles.verticalDetailsItem}
        >
          <ProDescriptions size="small" column={1}>
            {transaction.productType && (
              <ProDescriptions.Item label="Product Type" valueType="text">
                {transaction.productType}
              </ProDescriptions.Item>
            )}
            {transaction.promotionCodeUsed !== undefined && (
              <ProDescriptions.Item label="Promotino Code Used" valueType="text">
                {String(transaction.promotionCodeUsed)}
              </ProDescriptions.Item>
            )}
            {transaction.reference && (
              <ProDescriptions.Item label="Reference" valueType="text">
                {transaction.reference}
              </ProDescriptions.Item>
            )}
            {transaction.deviceData && (
              <ProDescriptions.Item
                label="Device Data"
                valueType="jsonCode"
                className={styles.verticalDetailsItem}
              >
                {JSON.stringify(transaction.deviceData)}
              </ProDescriptions.Item>
            )}
            {transaction.tags && transaction.tags.length > 0 && (
              <ProDescriptions.Item label="Tags">
                <span>
                  {transaction.tags.map((tag: TransactionTag, index) => (
                    <Tag color={'cyan'} key={index}>
                      <span>
                        {tag.key}: <span style={{ fontWeight: 700 }}>{tag.value}</span>
                      </span>
                    </Tag>
                  ))}
                </span>
              </ProDescriptions.Item>
            )}
          </ProDescriptions>
        </ProDescriptions.Item>
      </ProDescriptions>
    </>
  );
};
