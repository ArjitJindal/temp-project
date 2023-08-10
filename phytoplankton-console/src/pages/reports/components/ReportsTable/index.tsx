import React, { useState } from 'react';
import { Tag } from 'antd';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import cn from 'clsx';
import s from './index.module.less';
import { Report } from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { DATE, LONG_TEXT } from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { AllParams } from '@/components/library/Table/types';
import { useUsers } from '@/utils/user-utils';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { DefaultApiGetReportsRequest } from '@/apis/types/ObjectParamAPI';
import { useApi } from '@/api';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useApiTime } from '@/utils/tracker';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { REPORTS_LIST } from '@/utils/queries/keys';

type TableParams = AllParams<DefaultApiGetReportsRequest>;

export default function ReportsTable() {
  const helper = new ColumnHelper<Report>();
  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true });
  const api = useApi();
  const [params, setParams] = useState<TableParams>(DEFAULT_PARAMS_STATE);
  const measure = useApiTime();

  const queryResult = usePaginatedQuery<Report>(REPORTS_LIST(params), async (paginationParams) => {
    return await measure(() => api.getReports({ ...params, ...paginationParams }), 'Reports List');
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
      sorting: true,
    }),
    helper.simple<'description'>({
      title: 'Description',
      key: 'description',
      defaultWidth: 200,
      type: LONG_TEXT,
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
      },
    }),
    helper.simple<'createdAt'>({
      title: 'Created on',
      key: 'createdAt',
      type: DATE,
    }),
    helper.simple<'status'>({
      key: 'status',
      title: 'Status',
      type: {
        render: (status) => {
          return (
            <div>
              {status && (
                <Tag className={cn('TEST', s.tag, s[`status-${status}`])}>
                  {sentenceCase(status)}
                </Tag>
              )}
            </div>
          );
        },
        stringify: (status) => {
          return status || '';
        },
      },
    }),
    helper.simple<'updatedAt'>({
      title: 'Last updated',
      key: 'updatedAt',
      type: DATE,
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
    </>
  );
}
