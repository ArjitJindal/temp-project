import React, { useState } from 'react';
import { Space } from 'antd';
import cn from 'clsx';
import { COUNTRIES } from '@flagright/lib/constants';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import { Report, ReportStatus } from '@/apis';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { DATE, LONG_TEXT } from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { AllParams } from '@/components/library/Table/types';
import { isSuperAdmin, useAuth0User, useUsers } from '@/utils/user-utils';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { DefaultApiGetReportsRequest } from '@/apis/types/ObjectParamAPI';
import { useApi } from '@/api';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { REPORTS_LIST } from '@/utils/queries/keys';
import { message } from '@/components/library/Message';
import Select from '@/components/library/Select';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { REPORT_STATUSS } from '@/apis/models-custom/ReportStatus';
import { getUserLink, getUserName } from '@/utils/api/users';
import { getAccountUserName } from '@/utils/account';
import { humanizeConstant } from '@/utils/humanize';
import Tag from '@/components/library/Tag';

type TableParams = AllParams<DefaultApiGetReportsRequest>;

type StatusUpdate = { status: ReportStatus; statusInfo: string };

export default function ReportsTable() {
  const helper = new ColumnHelper<Report>();
  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true });
  const api = useApi();
  const [params, setParams] = useState<TableParams>(DEFAULT_PARAMS_STATE);
  const [displayStatusInfoReport, setDisplayStatusInfoReport] = useState<Report | undefined>();
  const [statusInfoEditing, setStatusInfoEditing] = useState<boolean>(false);
  const [statusUpdate, setStatusUpdate] = useState<StatusUpdate | null>(null);
  const user = useAuth0User();

  const queryResult = usePaginatedQuery<Report>(REPORTS_LIST(params), async (paginationParams) => {
    return await api.getReports({ ...params, ...paginationParams });
  });

  const columns = helper.list([
    helper.simple<'id'>({
      title: 'SAR ID',
      key: 'id',
      type: {
        render: (_value, { item: entity }) => {
          return (
            <>
              <Id
                to={makeUrl('/reports/:reportId', { reportId: entity.id })}
                testName="report-id"
                alwaysShowCopy={false}
              >
                {entity.id}
              </Id>
            </>
          );
        },
      },
    }),
    helper.simple<'description'>({
      title: 'Description',
      key: 'description',
      defaultWidth: 200,
      type: LONG_TEXT,
    }),
    helper.simple<'caseUser'>({
      title: 'Case user ID',
      key: 'caseUser',
      type: {
        render: (caseUser) => {
          if (caseUser === undefined) {
            return <div>Not Found</div>;
          }
          return (
            <div>
              <Id to={getUserLink(caseUser)}>{caseUser.userId}</Id>
            </div>
          );
        },
        stringify(caseUser) {
          if (caseUser === undefined) {
            return 'Not Found';
          }
          return caseUser.userId;
        },
      },
    }),
    helper.simple<'caseUser'>({
      title: 'Case user name',
      key: 'caseUser',
      type: {
        render: (caseUser) => {
          if (caseUser === undefined) {
            return <div>Not Found</div>;
          }
          return <div>{getUserName(caseUser)}</div>;
        },
        stringify(value) {
          if (value === undefined) {
            return 'Not Found';
          }
          return getUserName(value);
        },
      },
    }),
    helper.simple<'createdById'>({
      title: 'Created by',
      key: 'createdById',
      type: {
        render: (userId, _) => {
          return userId ? (
            <ConsoleUserAvatar userId={userId} users={users} loadingUsers={loadingUsers} />
          ) : (
            <>-</>
          );
        },
        stringify(value, items) {
          return items.createdById ? getAccountUserName(users[items.createdById]) : '-';
        },
      },
    }),
    helper.simple<'createdAt'>({
      title: 'Created at',
      key: 'createdAt',
      type: DATE,
    }),
    helper.derived<Report>({
      title: 'Status',
      value: (report) => report,
      type: {
        render: (report) => {
          return (
            <div className={s.status} onClick={() => setDisplayStatusInfoReport(report)}>
              {report?.status && (
                <Tag className={cn(s.tag, s[`status-${report.status}`])}>
                  {humanizeConstant(report.status)}
                </Tag>
              )}
            </div>
          );
        },
        stringify: (report) => {
          return report?.status || '';
        },
      },
    }),
    helper.simple<'updatedAt'>({
      title: 'Last updated',
      key: 'updatedAt',
      type: DATE,
    }),
    helper.simple<'reportTypeId'>({
      title: 'Jurisdiction',
      key: 'reportTypeId',
      type: {
        render: (reportTypeId) => {
          return reportTypeId ? <div>{COUNTRIES[reportTypeId.split('-')[0]]}</div> : <>-</>;
        },
        stringify: (reportTypeId) => {
          return reportTypeId ? COUNTRIES[reportTypeId.split('-')[0]] : '-';
        },
      },
    }),
  ]);

  return (
    <>
      <QueryResultsTable
        rowKey={'id'}
        columns={columns}
        queryResults={queryResult}
        params={params}
        onChangeParams={setParams}
      />
      <Modal
        title={
          displayStatusInfoReport &&
          `Report ${displayStatusInfoReport.id} status information (${humanizeConstant(
            displayStatusInfoReport.status,
          )})`
        }
        isOpen={Boolean(displayStatusInfoReport)}
        onCancel={() => {
          setDisplayStatusInfoReport(undefined);
          setStatusInfoEditing(false);
        }}
        onOk={async () => {
          if (!displayStatusInfoReport) {
            return;
          }
          if (!statusInfoEditing) {
            setStatusInfoEditing(true);
            setStatusUpdate({
              status: displayStatusInfoReport.status,
              statusInfo: displayStatusInfoReport.statusInfo || '',
            });
          } else {
            if (displayStatusInfoReport.id == null) {
              throw new Error(`displayStatusInfoReport.id can not be null`);
            }
            if (statusUpdate == null) {
              throw new Error(`statusUpdate can not be null`);
            }
            try {
              await api.postReportsReportIdStatus({
                reportId: displayStatusInfoReport.id,
                ReportStatusUpdateRequest: statusUpdate,
              });
              message.success('Saved');
            } catch (e) {
              message.error(`Failed to save: ${e}`);
            }
          }
        }}
        okText={statusInfoEditing ? 'Save' : 'Edit'}
        hideFooter={!isSuperAdmin(user)}
      >
        {statusInfoEditing && isSuperAdmin(user) ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              mode="SINGLE"
              style={{ width: 200 }}
              value={statusUpdate?.status}
              options={REPORT_STATUSS.map((v) => ({ label: humanizeConstant(v), value: v }))}
              onChange={(v) => {
                if (v != null) {
                  setStatusUpdate(
                    (prev) =>
                      prev && {
                        ...prev,
                        status: v,
                      },
                  );
                }
              }}
            />
            <MarkdownEditor
              key={displayStatusInfoReport?.id}
              initialValue={statusUpdate?.statusInfo || ''}
              onChange={(v) =>
                setStatusUpdate(
                  (prev) =>
                    prev && {
                      ...prev,
                      statusInfo: v || '',
                    },
                )
              }
            />
          </Space>
        ) : (
          <MarkdownViewer
            key={displayStatusInfoReport?.id}
            value={displayStatusInfoReport?.statusInfo || 'No additional information'}
          />
        )}
      </Modal>
    </>
  );
}
