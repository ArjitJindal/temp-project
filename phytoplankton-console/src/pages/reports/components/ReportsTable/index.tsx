import React from 'react';
import { Tag } from 'antd';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import cn from 'clsx';
import s from './index.module.less';
import { Report } from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { DATE_TIME, LONG_TEXT } from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { TableData } from '@/components/library/Table/types';
import { useUsers } from '@/utils/user-utils';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';

type Props = {
  queryResult: QueryResult<TableData<Report>>;
};

export default function ReportsTable(props: Props) {
  const helper = new ColumnHelper<Report>();
  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true });

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
      type: DATE_TIME,
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
      type: DATE_TIME,
    }),
  ]);

  return (
    <>
      <QueryResultsTable rowKey={'id'} columns={columns} queryResults={props.queryResult} />
    </>
  );
}
