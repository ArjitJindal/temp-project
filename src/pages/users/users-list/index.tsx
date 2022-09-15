import { Tabs } from 'antd';
import { useLocalStorageState } from 'ahooks';
import { useCallback, useEffect } from 'react';
import moment from 'moment';
import { useNavigate, useParams } from 'react-router';
import type { TableListPagination } from './data.d';
import styles from './UsersList.module.less';
import UserRiskTag from './UserRiskTag';
import { getBusinessUserColumns } from './business-user-columns';
import { getConsumerUserColumns } from './consumer-users-columns';
import { RequestTable } from '@/components/RequestTable';
import { useApi } from '@/api';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import PageWrapper from '@/components/PageWrapper';
import { measure } from '@/utils/time-utils';
import { useAnalytics } from '@/utils/segment/context';
import '../../../components/ui/colors';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';
import { TableColumn, TableRow } from '@/components/ui/Table/types';

const BusinessUsersTab = () => {
  const api = useApi();

  const columns: TableColumn<TableRow<InternalBusinessUser>>[] = getBusinessUserColumns();

  const analytics = useAnalytics();
  const request = useCallback(
    async (params) => {
      const { pageSize, current, userId, createdTimestamp } = params;
      const [response, time] = await measure(() =>
        api.getBusinessUsersList({
          limit: pageSize!,
          skip: (current! - 1) * pageSize!,
          afterTimestamp: createdTimestamp ? moment(createdTimestamp[0]).valueOf() : 0,
          beforeTimestamp: createdTimestamp ? moment(createdTimestamp[1]).valueOf() : Date.now(),
          filterId: userId,
        }),
      );
      analytics.event({
        title: 'Table Loaded',
        time,
      });
      return {
        items: response.data,
        success: true,
        total: response.total,
      };
    },
    [analytics, api],
  );

  return (
    <>
      <RequestTable<InternalBusinessUser, TableListPagination>
        form={{
          labelWrap: true,
        }}
        rowKey="userId"
        search={{
          labelWidth: 120,
        }}
        className={styles.table}
        scroll={{ x: 1300 }}
        request={request}
        columns={columns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-list-table',
        }}
      />
    </>
  );
};

const ConsumerUsersTab = () => {
  const isPulseEnabled = useFeature('PULSE');
  const api = useApi();
  const columns: TableColumn<InternalConsumerUser>[] = getConsumerUserColumns();
  {
    if (isPulseEnabled) {
      columns.push({
        title: 'Risk Level',
        dataIndex: 'labels',
        tip: 'Dynamic risk Score - accounts for both Base risk and action risk scores.',
        search: false,
        render: (dom, entity) => {
          return <UserRiskTag userId={entity.userId} />;
        },
      });
    }
  }

  const analytics = useAnalytics();
  const request = useCallback(
    async (params) => {
      const { pageSize, current, userId, createdTimestamp } = params;
      const [response, time] = await measure(() =>
        api.getConsumerUsersList({
          limit: pageSize!,
          skip: (current! - 1) * pageSize!,
          afterTimestamp: createdTimestamp ? moment(createdTimestamp[0]).valueOf() : 0,
          beforeTimestamp: createdTimestamp ? moment(createdTimestamp[1]).valueOf() : Date.now(),
          filterId: userId,
        }),
      );
      analytics.event({
        title: 'Table Loaded',
        time,
      });
      return {
        items: response.data,
        success: true,
        total: response.total,
      };
    },
    [analytics, api],
  );

  return (
    <>
      <RequestTable<InternalConsumerUser, TableListPagination>
        form={{
          labelWrap: true,
        }}
        rowKey="userId"
        search={{
          labelWidth: 120,
        }}
        className={styles.table}
        scroll={{ x: 500 }}
        request={request}
        columns={columns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-list',
        }}
      />
    </>
  );
};

export default function UsersList() {
  const { list = 'consumer' } = useParams<'list' | 'id'>();
  const navigate = useNavigate();
  const i18n = useI18n();
  const [_, setLocalStorageActiveTab] = useLocalStorageState('user-active-tab', list);
  useEffect(() => {
    setLocalStorageActiveTab(list);
  }, [setLocalStorageActiveTab, list]);
  return (
    <PageWrapper title={i18n('menu.users.lists')}>
      <PageTabs
        activeKey={list}
        destroyInactiveTabPane={true}
        onChange={(key) => {
          navigate(makeUrl(`/users/list/:list/all`, { list: key }), { replace: true });
        }}
      >
        <Tabs.TabPane tab="Consumer Users" key="consumer">
          <ConsumerUsersTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Business Users" key="business">
          <BusinessUsersTab />
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
}
