/* eslint-disable @typescript-eslint/no-var-requires */
import ProDescriptions from '@ant-design/pro-descriptions';
import {
  Avatar,
  Col,
  Comment as AntComment,
  Divider,
  Input,
  List,
  message,
  Popover,
  Row,
  Select,
  Space,
  Tag,
  Upload,
} from 'antd';
import { useCallback, useMemo, useState } from 'react';
import {
  EditOutlined,
  HistoryOutlined,
  LoadingOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import styles from './TransactionDetails.less';
import { RuleActionStatus } from './RuleActionStatus';
import Comment from './Comment';
import {
  Comment as TransactionComment,
  FileInfo,
  Tag as TransactionTag,
  TransactionCaseManagement,
} from '@/apis';
import { useApi } from '@/api';
import { RULE_ACTION_OPTIONS } from '@/pages/rules/utils';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import Button from '@/components/ui/Button';
import { getUserName } from '@/utils/api/users';
import UserLink from '@/components/UserLink';

const equal = require('fast-deep-equal');

interface Props {
  transaction: TransactionCaseManagement;
  onTransactionUpdate: (newTransaction: TransactionCaseManagement) => void;
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
    (s3Key) => setFiles((prevFiles) => prevFiles.filter((file) => file.s3Key !== s3Key)),
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
          <Button analyticsName="Attach files" size="small" icon={<PaperClipOutlined />}>
            Attach files
          </Button>
        </Upload>
      </Col>
      <Col span={24}>
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
    </Row>
  );
};

export const TransactionDetails: React.FC<Props> = ({ transaction, onTransactionUpdate }) => {
  const user = useAuth0User();
  const api = useApi();
  const [users, loadingUsers] = useUsers();
  const currentUserId = user.userId ?? undefined;
  const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState(transaction.assignments || []);
  const [status, setStatus] = useState(transaction.status);
  const canSave = useMemo(() => {
    return status !== transaction.status || !equal(assignments, transaction.assignments);
  }, [assignments, status, transaction.assignments, transaction.status]);
  const handleCancelEditing = useCallback(() => {
    setEditing(false);
    setStatus(transaction.status);
    setAssignments(transaction.assignments || []);
  }, [transaction.assignments, transaction.status]);
  const handleCommentAdded = useCallback(
    (newComment: TransactionComment) => {
      onTransactionUpdate({
        ...transaction,
        comments: [...(transaction.comments || []), newComment],
      });
    },
    [onTransactionUpdate, transaction],
  );
  const handleDeleteComment = useCallback(
    async (transactionId: string, commentId: string) => {
      setDeletingCommentIds((prevIds) => [...prevIds, commentId]);
      await api.deleteTransactionsTransactionIdCommentsCommentId({ transactionId, commentId });
      setDeletingCommentIds((prevIds) => prevIds.filter((prevId) => prevId !== commentId));
      onTransactionUpdate({
        ...transaction,
        comments: (transaction.comments || []).filter((comment) => comment.id !== commentId),
      });
      message.success('Comment deleted');
    },
    [api, onTransactionUpdate, transaction],
  );
  const handleUpdateAssignments = useCallback(
    (assignees: string[]) => {
      setAssignments(
        assignees.map((assigneeUserId) => ({
          assignedByUserId: currentUserId as string,
          assigneeUserId,
          timestamp: Date.now(),
        })),
      );
    },
    [currentUserId],
  );
  const handleUpdateTransaction = useCallback(async () => {
    const hideMessage = message.loading(`Saving...`, 0);
    try {
      setSaving(true);
      await api.postTransactionsTransactionId({
        transactionId: transaction.transactionId as string,
        TransactionUpdateRequest: {
          status: status === transaction.status ? undefined : status,
          assignments,
        },
      });
      onTransactionUpdate({
        ...transaction,
        status,
        assignments,
      });
      message.success('Saved');
      setEditing(false);
    } catch (e) {
      message.error('Failed to save');
    } finally {
      hideMessage();
      setSaving(false);
    }
  }, [api, assignments, onTransactionUpdate, status, transaction]);
  return (
    <>
      <Row justify="end">
        {editing ? (
          <Space>
            <Button analyticsName="Cancel" onClick={handleCancelEditing} size="small">
              Cancel
            </Button>
            <Button
              analyticsName="Save"
              type="primary"
              size="small"
              onClick={handleUpdateTransaction}
              loading={saving}
              disabled={!canSave}
            >
              Save
            </Button>
          </Space>
        ) : (
          <Button
            analyticsName="Edit"
            icon={<EditOutlined />}
            onClick={() => setEditing(true)}
            size="small"
          >
            Edit
          </Button>
        )}
      </Row>
      <ProDescriptions size="small" column={1} colon={false}>
        <ProDescriptions.Item label={<b>Transaction ID:</b>} valueType="text">
          {transaction.transactionId}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Timestamp:</b>} valueType="dateTime">
          {transaction.timestamp}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Status:</b>}>
          {editing ? (
            <Select disabled={!editing} style={{ width: 120 }} value={status} onChange={setStatus}>
              {RULE_ACTION_OPTIONS.map((option) => (
                <Select.Option key={option.value}>
                  <RuleActionStatus ruleAction={option.value} />
                </Select.Option>
              ))}
            </Select>
          ) : (
            <Row align="middle">
              <Space>
                <RuleActionStatus ruleAction={status} />
                <Popover
                  content={transaction.statusChanges?.filter(Boolean).map((statusChange) => (
                    <Row>
                      {`Changed to ${statusChange.status} by ${
                        users[statusChange.userId]?.name || statusChange.userId
                      } at ${new Date(statusChange.timestamp).toISOString()}`}
                    </Row>
                  ))}
                >
                  <HistoryOutlined />
                </Popover>
              </Space>
            </Row>
          )}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Assignees:</b>}>
          {editing ? (
            <Select<string[]>
              mode="multiple"
              allowClear
              style={{ width: '100%' }}
              disabled={loadingUsers}
              placeholder={
                loadingUsers ? (
                  <>
                    <LoadingOutlined /> Loading...
                  </>
                ) : (
                  ''
                )
              }
              onChange={handleUpdateAssignments}
              value={loadingUsers ? [] : assignments.map((assignment) => assignment.assigneeUserId)}
            >
              {Object.values(users).map((user) => (
                <Select.Option key={user.user_id}>
                  <Avatar size={15} src={user.picture} /> {user.name}
                </Select.Option>
              ))}
            </Select>
          ) : (
            assignments?.map((assignment) => (
              <Tag>
                <Space>
                  <Avatar size={15} src={users[assignment.assigneeUserId]?.picture} />
                  {users[assignment.assigneeUserId]?.name}
                </Space>
              </Tag>
            ))
          )}
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
              {transaction.originUser !== undefined ? (
                <UserLink user={transaction.originUser}>
                  {String(transaction.originUserId)}
                </UserLink>
              ) : (
                String(transaction.originUserId)
              )}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="User Name" valueType="text">
              {getUserName(transaction.originUser)}
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
              {transaction.destinationUser !== undefined ? (
                <UserLink user={transaction.destinationUser}>
                  {String(transaction.destinationUserId)}
                </UserLink>
              ) : (
                String(transaction.destinationUserId)
              )}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="User Name" valueType="text">
              {getUserName(transaction.destinationUser)}
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
      {/* Comments */}
      <Divider orientation="left" orientationMargin="0">
        {`Comments (${transaction.comments?.length || 0})`}
      </Divider>
      {transaction.comments && transaction.comments?.length > 0 && (
        <List
          dataSource={transaction.comments}
          itemLayout="horizontal"
          renderItem={(comment) => (
            <Comment
              comment={comment}
              currentUserId={currentUserId}
              deletingCommentIds={deletingCommentIds}
              onDelete={() => {
                handleDeleteComment(transaction.transactionId!, comment.id!);
              }}
            />
          )}
        />
      )}
      <AntComment
        avatar={<Avatar src={user?.picture} />}
        content={
          <CommentEditor
            transactionId={transaction.transactionId!}
            onCommentAdded={handleCommentAdded}
          />
        }
      />
    </>
  );
};
