import { useCallback, useMemo, useState } from 'react';
import { COUNTRIES } from '@flagright/lib/constants';
import { uniqBy } from 'lodash';
import { useLocation, useNavigate } from 'react-router';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { useQueryClient } from '@tanstack/react-query';
import pluralize from 'pluralize';
import s from './index.module.less';
import { sarQueryAdapter } from './helper';
import ReportStatusChangeModal from './ReportStatusChangeModal';
import ReportStatusTag from './ReportStatusTag';
import { Option } from '@/components/library/Select';
import { CountryCode, Report, ReportStatus, ReportTypesResponse } from '@/apis';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { DATE, ID, LONG_TEXT, STRING } from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { AllParams, CommonParams } from '@/components/library/Table/types';
import { getDisplayedUserInfo, useHasPermissions, useUsers } from '@/utils/user-utils';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import Id from '@/components/ui/Id';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useApi } from '@/api';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { REPORT_SCHEMAS, REPORTS_LIST } from '@/utils/queries/keys';
import { REPORT_STATUSS } from '@/apis/models-custom/ReportStatus';
import { getUserLink, getUserName } from '@/utils/api/users';
import { getOr } from '@/utils/asyncResource';
import { AccountsFilter } from '@/components/library/AccountsFilter';
import { useDeepEqualEffect } from '@/utils/hooks';
import { dayjs } from '@/utils/dayjs';
import Button from '@/components/library/Button';
import Confirm from '@/components/utils/Confirm';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { getErrorMessage } from '@/utils/lang';
import { notEmpty } from '@/utils/array';
import { message } from '@/components/library/Message';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

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

export default function ReportsTable() {
  const settings = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const parsedParams = useMemo(
    () => sarQueryAdapter.deserializer(parseQueryString(location.search)),
    [location.search],
  );

  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true });
  const api = useApi({ debounce: 500 });
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

  const queryClient = useQueryClient();
  const canWrite = useHasPermissions(['reports:generated:write']);

  useDeepEqualEffect(() => {
    setParams((prevState: AllParams<TableParams>) => ({
      ...prevState,
      ...parsedParams,
      sort: parsedParams.sort ?? [],
      pageSize: parsedParams.pageSize ?? DEFAULT_PARAMS_STATE.pageSize,
      page: parsedParams.page ?? DEFAULT_PARAMS_STATE.page,
    }));
  }, [parsedParams]);

  const reportListQueryKeys = REPORTS_LIST(params);
  const queryResult = usePaginatedQuery<Report>(reportListQueryKeys, async (paginationParams) => {
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

  const deleteMutation = useMutation<unknown, unknown, { reportIds: string[] }>(
    async (variables) => {
      const hideMessage = message.loading('Deleting reports...');
      try {
        await api.deleteReports({
          ReportsDeleteRequest: {
            reportIds: variables.reportIds,
          },
        });
        message.success(`${pluralize('Report', variables.reportIds.length)} deleted!`);
      } catch (e) {
        console.error(e);
        message.error(`Unable to delete reports: ${getErrorMessage(e)}`);
      } finally {
        hideMessage();
      }
    },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries(REPORTS_LIST({}));
      },
    },
  );

  const columns = useMemo(() => {
    const helper = new ColumnHelper<Report>();
    return helper.list(
      [
        helper.simple<'id'>({
          title: 'SAR ID',
          key: 'id',
          type: {
            render: (_value, { item: entity }) => {
              return (
                <Id
                  to={canWrite ? makeUrl('/reports/:reportId', { reportId: entity.id }) : undefined}
                  testName="report-id"
                  alwaysShowCopy={!canWrite}
                >
                  {entity.id}
                </Id>
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
        helper.derived({
          title: `Case ${settings.userAlias} ID`,
          id: 'caseUserId',
          value: (report) => report.caseUser?.userId,
          type: {
            ...ID,
            render: (id, { item: report }) => {
              if (!report.caseUser) {
                return <div>-</div>;
              }
              return (
                <div>
                  <Id to={getUserLink(report.caseUser)}>{id}</Id>
                </div>
              );
            },
          },
        }),
        helper.derived({
          title: `Case ${settings.userAlias} name`,
          id: 'caseUserName',
          value: (report) => getUserName(report.caseUser),
          type: STRING,
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
                <div className={s.status}>
                  {report?.status && <ReportStatusTag status={report.status} />}
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
                reportTypes.data?.map((type) => ({
                  value: type.countryCode,
                  label: type.country,
                })) ?? [],
                'value',
              ),
              mode: 'SINGLE',
              displayMode: 'list',
            },
          },
          filtering: true,
        }),
        canWrite &&
          helper.display({
            title: 'Actions',
            defaultWidth: 200,
            render: (report) => (
              <div className={s.actions}>
                <Button type={'SECONDARY'} onClick={() => setDisplayStatusInfoReport(report)}>
                  Status
                </Button>
                {report.status === 'DRAFT' && (
                  <Confirm
                    text={`Are you sure you want to delete ${report.id} report?`}
                    onConfirm={() => {
                      if (report.id) {
                        deleteMutation.mutate({ reportIds: [report.id] });
                      }
                    }}
                  >
                    {({ onClick }) => (
                      <Button type={'DANGER'} onClick={onClick}>
                        Delete
                      </Button>
                    )}
                  </Confirm>
                )}
              </div>
            ),
          }),
      ].filter(notEmpty),
    );
  }, [
    canWrite,
    deleteMutation,
    reportTypes,
    loadingUsers,
    users,
    setDisplayStatusInfoReport,
    settings.userAlias,
  ]);

  return (
    <>
      <QueryResultsTable
        rowKey={'id'}
        fitHeight={true}
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
            title: `Case ${settings.userAlias} ID`,
            renderer: {
              kind: 'string',
            },
          },
        ]}
      />
      <ReportStatusChangeModal
        report={displayStatusInfoReport}
        reportStatuses={
          reportTypes.data.find(
            (type) => type.countryCode === displayStatusInfoReport?.reportTypeId.split('-')[0],
          )?.reportStatuses ?? []
        }
        onClose={() => setDisplayStatusInfoReport(undefined)}
      />
    </>
  );
}
