import React, { useCallback, useMemo, useState } from 'react';
import { Space } from 'antd';
import cn from 'clsx';
import { COUNTRIES } from '@flagright/lib/constants';
import { uniqBy } from 'lodash';
import { useLocation, useNavigate } from 'react-router';
import s from './index.module.less';
import { sarQueryAdapter } from './helper';
import Modal from '@/components/library/Modal';
import { CountryCode, Report, ReportStatus, ReportTypesResponse } from '@/apis';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { DATE, LONG_TEXT } from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { AllParams, CommonParams } from '@/components/library/Table/types';
import { getDisplayedUserInfo, isSuperAdmin, useAuth0User, useUsers } from '@/utils/user-utils';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import Id from '@/components/ui/Id';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useApi } from '@/api';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { REPORT_SCHEMAS, REPORTS_LIST } from '@/utils/queries/keys';
import { message } from '@/components/library/Message';
import Select, { Option } from '@/components/library/Select';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { REPORT_STATUSS } from '@/apis/models-custom/ReportStatus';
import { getUserLink, getUserName } from '@/utils/api/users';
import { humanizeConstant } from '@/utils/humanize';
import Tag from '@/components/library/Tag';
import { getOr } from '@/utils/asyncResource';
import { AccountsFilter } from '@/components/library/AccountsFilter';
import { useDeepEqualEffect } from '@/utils/hooks';
import { dayjs } from '@/utils/dayjs';

interface TableSearchParams extends CommonParams {
  id?: string;
  filterCaseUserId?: string;
  reportTypeId?: string;
  filterCreatedBy?: string[];
  filterStatus?: ReportStatus[];
  createdAt?: string[];
  caseId?: string;
}

export type TableParams = AllParams<TableSearchParams>;

type StatusUpdate = { status: ReportStatus; statusInfo: string };

export default function ReportsTable() {
  const location = useLocation();
  const navigate = useNavigate();
  const parsedParams = useMemo(
    () => sarQueryAdapter.deserializer(parseQueryString(location.search)),
    [location.search],
  );

  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true });
  const api = useApi();
  const [params, setParams] = useState<TableParams>(DEFAULT_PARAMS_STATE);

  const pushParamsToNavigation = useCallback(
    (params) => {
      navigate(makeUrl('/reports', {}, sarQueryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate],
  );

  const handleChangeParams = (newParams: AllParams<TableParams>) => {
    pushParamsToNavigation(newParams);
  };

  const [displayStatusInfoReport, setDisplayStatusInfoReport] = useState<Report | undefined>();
  const [statusInfoEditing, setStatusInfoEditing] = useState<boolean>(false);
  const [statusUpdate, setStatusUpdate] = useState<StatusUpdate | null>(null);
  const user = useAuth0User();

  useDeepEqualEffect(() => {
    setParams((prevState: AllParams<TableParams>) => ({
      ...prevState,
      ...parsedParams,
      sort: parsedParams.sort ?? [],
      pageSize: parsedParams.pageSize ?? DEFAULT_PARAMS_STATE.pageSize,
      page: parsedParams.page ?? DEFAULT_PARAMS_STATE.page,
    }));
  }, [parsedParams]);

  const queryResult = usePaginatedQuery<Report>(REPORTS_LIST(params), async (paginationParams) => {
    return await api.getReports({
      page: params.page,
      pageSize: params.pageSize,
      ...paginationParams,
      filterReportId: params.id,
      filterCaseUserId: params.filterCaseUserId,
      filterJurisdiction: params.reportTypeId as CountryCode,
      filterCreatedBy: params.filterCreatedBy,
      filterStatus: params.filterStatus,
      createdAtAfterTimestamp: params.createdAt?.map((t) => dayjs(t).valueOf())[0],
      createdAtBeforeTimestamp: params.createdAt?.map((t) => dayjs(t).valueOf())[1],
      caseId: params.caseId,
    });
  });

  const reportTypesQueryResult = useQuery<ReportTypesResponse>(REPORT_SCHEMAS(), () => {
    return api.getReportTypes();
  });
  const reportTypes = getOr(reportTypesQueryResult.data, { data: [], total: 0 });
  const columns = useMemo(() => {
    const helper = new ColumnHelper<Report>();
    return helper.list([
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
          autoFilterDataType: {
            kind: 'string',
          },
        },
        filtering: true,
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
            if (!caseUser) {
              return <div>Not Found</div>;
            }
            return (
              <div>
                <Id to={getUserLink(caseUser)}>{caseUser.userId}</Id>
              </div>
            );
          },
          stringify(caseUser) {
            if (!caseUser) {
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
            if (!caseUser) {
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
            return items.createdById ? getDisplayedUserInfo(users[items.createdById]).name : '-';
          },
        },
      }),
      helper.simple<'createdAt'>({
        title: 'Created at',
        key: 'createdAt',
        type: DATE,
        filtering: true,
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
          autoFilterDataType: {
            kind: 'select',
            options: uniqBy<Option<string>>(
              reportTypes.data?.map((type) => ({ value: type.countryCode, label: type.country })) ??
                [],
              'value',
            ),
            mode: 'SINGLE',
            displayMode: 'list',
          },
        },
        filtering: true,
      }),
    ]);
  }, [reportTypes, loadingUsers, users]);

  return (
    <>
      <QueryResultsTable
        rowKey={'id'}
        columns={columns}
        queryResults={queryResult}
        params={params}
        onChangeParams={handleChangeParams}
        extraFilters={[
          {
            key: 'filterStatus',
            title: 'Status',
            renderer: {
              kind: 'select',
              options: REPORT_STATUSS.map((v) => ({ label: humanizeConstant(v), value: v })),
              mode: 'MULTIPLE',
              displayMode: 'list',
            },
          },
          {
            key: 'filterCreatedBy',
            title: 'Created by',
            renderer: ({ params, setParams }) => (
              <AccountsFilter
                title="Created by"
                users={params.filterCreatedBy ?? []}
                includeUnassigned={false}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    filterCreatedBy: value,
                  }));
                }}
              />
            ),
          },
          {
            key: 'caseId',
            title: 'Case ID',
            renderer: {
              kind: 'string',
            },
          },
          {
            key: 'filterCaseUserId',
            title: 'Case user ID',
            renderer: {
              kind: 'string',
            },
          },
        ]}
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
