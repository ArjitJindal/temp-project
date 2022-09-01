import React, { useCallback, useState } from 'react';
import { message, Popover, Row, Select, Space, Tag } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import s from './index.module.less';
import { TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import UserShared2LineIcon from '@/components/ui/icons/Remix/user/user-shared-2-line.react.svg';
import PulseLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import BriefcaseLineIcon from '@/components/ui/icons/Remix/business/briefcase-line.react.svg';
import FileListLineIcon from '@/components/ui/icons/Remix/document/file-list-line.react.svg';
import * as Form from '@/components/ui/Form';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import Button from '@/components/ui/Button';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { RULE_ACTION_OPTIONS } from '@/pages/rules/utils';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { ClosingReasonTag } from '@/pages/case-management/components/ClosingReasonTag';

export default function Header(props: { transaction: TransactionCaseManagement }) {
  const { transaction } = props;
  const { transactionId } = transaction;

  const api = useApi();
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;
  const [users] = useUsers();

  const [status, setStatus] = useState(transaction.status);
  const [assignments, setAssignments] = useState(transaction.assignments || []);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const handleCancelEditing = useCallback(() => {
    setEditing(false);
    setStatus(transaction.status);
    setAssignments(transaction.assignments || []);
  }, [transaction.status, transaction.assignments]);

  const handleUpdateTransaction = useCallback(async () => {
    const hideMessage = message.loading(`Saving...`, 0);
    try {
      setSaving(true);
      await api.postTransactions({
        TransactionsUpdateRequest: {
          transactionIds: transactionId ? [transactionId] : [],
          transactionUpdates: {
            status: status === transaction.status ? undefined : status,
            assignments,
          },
        },
      });
      message.success('Saved');
      setEditing(false);
    } catch (e) {
      message.error('Failed to save');
    } finally {
      hideMessage();
      setSaving(false);
    }
  }, [api, assignments, status, transactionId, transaction.status]);

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

  const statusChanges = transaction.statusChanges ?? [];
  console.log('statusChanges', statusChanges);
  return (
    <>
      <EntityHeader idTitle={'Case ID'} id={transaction.transactionId}>
        <div className={s.items}>
          <Form.Layout.Label icon={<UserShared2LineIcon />} title={'Assigned to'}>
            <AssigneesDropdown
              assignments={assignments}
              editing={editing}
              onChange={handleUpdateAssignments}
            />
          </Form.Layout.Label>
          <Form.Layout.Label icon={<PulseLineIcon />} title={'Status'}>
            {editing ? (
              <Select
                disabled={!editing}
                style={{ width: 120 }}
                value={status}
                onChange={setStatus}
              >
                {RULE_ACTION_OPTIONS.map((option) => (
                  <Select.Option key={option.value}>
                    <RuleActionStatus ruleAction={option.value} />
                  </Select.Option>
                ))}
              </Select>
            ) : (
              <Row align="middle">
                <Space>
                  {status && <RuleActionStatus ruleAction={status} />}
                  <Popover
                    content={statusChanges?.filter(Boolean).map((statusChange) => (
                      <Row>
                        {`Changed to ${statusChange.status} by ${
                          users[statusChange.userId]?.name || statusChange.userId
                        } at ${new Date(statusChange.timestamp).toISOString()}`}
                      </Row>
                    ))}
                  ></Popover>
                </Space>
              </Row>
            )}
          </Form.Layout.Label>
          <Form.Layout.Label icon={<BriefcaseLineIcon />} title={'Case Type'}>
            <TransactionTypeTag transactionType={transaction.type} />
          </Form.Layout.Label>
          <Form.Layout.Label icon={<BriefcaseLineIcon />} title={'Case Status'}>
            <Tag
              className={s.caseStatusTag}
              color={transaction.caseStatus === 'CLOSED' ? 'warning' : 'success'}
            >
              {transaction.caseStatus}
            </Tag>
          </Form.Layout.Label>
          {editing ? (
            <div className={s.buttons}>
              <Button analyticsName="Cancel" onClick={handleCancelEditing} size="small">
                Cancel
              </Button>
              <Button
                analyticsName="Save"
                type="primary"
                size="small"
                onClick={handleUpdateTransaction}
                loading={saving}
              >
                Save
              </Button>
            </div>
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
        </div>
      </EntityHeader>
      <div className={s.closingReason}>
        <Form.Layout.Label icon={<FileListLineIcon />} title={'Reason for closing'}>
          {transaction.caseStatus === 'CLOSED' && statusChanges.length > 0 && (
            <ClosingReasonTag
              closingReasons={statusChanges[statusChanges.length - 1].reason}
              otherReason={statusChanges[statusChanges.length - 1].otherReason}
            />
          )}
        </Form.Layout.Label>
      </div>
    </>
  );
}
