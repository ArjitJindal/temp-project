/* eslint-disable @typescript-eslint/no-var-requires */

import { ActionType, ProColumns } from '@ant-design/pro-table';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import moment, { Moment } from 'moment';
import { Card, DatePicker, message, Space } from 'antd';
import { Link } from 'react-router-dom';
import _ from 'lodash';
import style from '../../style.module.less';
import header from '../dashboardutils';
import s from './styles.module.less';
import { TableItem } from './types';
import { useApi } from '@/api';
import Table, { ResponsePayload } from '@/components/ui/Table';
import ResizableTitle from '@/utils/table-utils';
import handleResize from '@/components/ui/Table/utils';
import Button from '@/components/ui/Button';
import { makeUrl } from '@/utils/routing';
import UserTypeIcon from '@/components/ui/UserTypeIcon';
import UserLink from '@/components/UserLink';
import { getUserName } from '@/utils/api/users';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { DefaultApiPostConsumerUsersUserIdRequest } from '@/apis/types/ObjectParamAPI';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

export default function HitsPerUserCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'week'),
    moment(),
  ]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: number]: number;
  }>({});

  const actionRef = useRef<ActionType>();
  useEffect(() => {
    if (actionRef.current) {
      actionRef.current?.reload();
    }
  }, [dateRange]);
  const handleBlockUser = useCallback(
    async (user: InternalConsumerUser | InternalBusinessUser) => {
      const params: DefaultApiPostConsumerUsersUserIdRequest = {
        userId: user.userId,
        UserUpdateRequest: {
          userStateDetails: {
            state: 'BLOCKED',
            reason: 'Manually blocked from dashboard',
          },
        },
      };
      const userName = getUserName(user);
      const hideMessage = message.loading(`Blocking ${userName}...`, 0);
      try {
        await (user.type === 'CONSUMER'
          ? api.postConsumerUsersUserId(params)
          : api.postBusinessUsersUserId(params));
        message.success(`Blocked ${userName}`);
        setBlockedUsers((prev) => [...prev, user.userId]);
      } catch (e) {
        message.error(`Failed to block ${userName}`);
      } finally {
        hideMessage();
      }
    },
    [api],
  );

  const columns: ProColumns<TableItem>[] = [
    {
      title: 'User ID',
      dataIndex: 'originUserId',
      width: 300,
      render: (dom, entity) => {
        const { user } = entity;
        if (user == null) {
          return dom;
        }
        return <UserLink user={user}>{dom}</UserLink>;
      },
    },
    {
      title: 'User Name',
      dataIndex: 'user',
      width: 300,
      render: (_, { user }) => getUserName(user),
    },
    {
      title: 'Rules hit',
      dataIndex: 'rulesHit',
      width: 300,
    },
    {
      title: 'User Type',
      width: 300,
      render: (dom, entity) => {
        const { user } = entity;
        if (user == null) {
          return dom;
        }
        return (
          <div className={s.userType}>
            <UserTypeIcon type={user.type} /> <span>{_.capitalize(user.type)}</span>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      width: 300,
      render: (dom, entity) => {
        const { user } = entity;
        if (user == null) {
          return dom;
        }
        const isBlocked =
          user.userStateDetails?.state === 'BLOCKED' || blockedUsers.includes(user.userId);
        return (
          <Space>
            <Link
              key="view-cases"
              to={makeUrl(
                '/case-management/all',
                {},
                {
                  originUserId: user.userId,
                },
              )}
            >
              <Button analyticsName="View user cases" size="small" type="ghost">
                View Cases
              </Button>
            </Link>
            <Feature name="DASHBOARD_BLOCK_USER">
              <Button
                key="block-use"
                size="small"
                type="ghost"
                disabled={isBlocked}
                onClick={() => handleBlockUser(user)}
              >
                {isBlocked ? 'Blocked' : 'Block'}
              </Button>
            </Feature>
          </Space>
        );
      },
    },
  ];
  const mergeColumns: ProColumns<TableItem>[] = columns.map((col, index) => ({
    ...col,
    width: updatedColumnWidth[index] || col.width,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<TableItem>).width,
      onResize: handleResize(index, setUpdatedColumnWidth),
    }),
  }));

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <Table<TableItem>
        actionRef={actionRef}
        form={{
          labelWrap: true,
        }}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        className={style.table}
        scroll={{ x: 1300 }}
        headerTitle={header('Top origin users by Rule Hits')}
        rowKey="originUserId"
        tooltip="Origin is the Sender in a transaction"
        search={false}
        columns={mergeColumns}
        toolBarRender={() => [<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
        request={async (): Promise<ResponsePayload<TableItem>> => {
          let startTimestamp = moment().subtract(1, 'day').valueOf();
          let endTimestamp = Date.now();

          const [start, end] = dateRange ?? [];
          if (start != null && end != null) {
            startTimestamp = start.startOf('day').valueOf();
            endTimestamp = end.endOf('day').valueOf();
          }

          const result = await api.getDashboardStatsHitsPerUser({
            startTimestamp,
            endTimestamp,
          });
          setBlockedUsers([]);

          return {
            success: true,
            total: result.data.length,
            data: result.data,
          };
        }}
        pagination={false}
        options={{
          density: false,
          setting: false,
          reload: true,
        }}
      />
    </Card>
  );
}
