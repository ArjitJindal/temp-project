import { Drawer, Tabs } from 'antd';
import { useLocalStorageState } from 'ahooks';
import { useCallback, useEffect, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-table';
import moment from 'moment';
import { useNavigate, useParams } from 'react-router';
import type { TableListPagination } from './data.d';
import styles from './UsersList.module.less';
import UserRiskTag from './components/UserRiskTag';
import { ConsumerUserDetails } from './components/ConsumerUserDetails';
import { BusinessUserDetails } from './components/BusinessUserDetails';
import { getBusinessUserColumns } from './business-user-columns';
import { getConsumerUserColumns } from './consumer-users-columns';
import { Table } from '@/components/ui/Table';
import { useApi } from '@/api';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ApiException, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import PageWrapper from '@/components/PageWrapper';
import {
  AsyncResource,
  failed,
  init,
  isInit,
  isSuccess,
  loading,
  success,
} from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { measure } from '@/utils/time-utils';
import { useAnalytics } from '@/utils/segment/context';
import '../../../components/ui/colors';
import ResizableTitle from '@/utils/table-utils';
import { useI18n } from '@/locales';
import handleResize from '@/components/ui/Table/utils';

const BusinessUsersTab = (props: { id?: string }) => {
  const [currentItem, setCurrentItem] = useState<AsyncResource<InternalBusinessUser>>(init());
  const api = useApi();
  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: number]: number;
  }>({});

  const { id: userId } = props;
  const currentUserId = isSuccess(currentItem) ? currentItem.value.userId : null;
  useEffect(() => {
    if (userId == null || userId === 'all') {
      setCurrentItem(init());
      return function () {};
    }
    if (currentUserId === userId) {
      return function () {};
    }
    setCurrentItem(loading());
    let isCanceled = false;
    api
      .getBusinessUsersItem({
        userId,
      })
      .then((user) => {
        if (isCanceled) {
          return;
        }
        setCurrentItem(success(user));
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        // todo: i18n
        let message = 'Unknown error';
        if (e instanceof ApiException && e.code === 404) {
          message = `Unable to find user by id "${userId}"`;
        } else if (e instanceof Error && e.message) {
          message = e.message;
        }
        setCurrentItem(failed(message));
      });
    return () => {
      isCanceled = true;
    };
  }, [currentUserId, userId, api]);

  const columns: ProColumns<InternalBusinessUser>[] = getBusinessUserColumns((user) =>
    setCurrentItem(success(user)),
  );

  const mergeColumns: ProColumns<InternalBusinessUser>[] = columns.map((col, index) => ({
    ...col,
    width: updatedColumnWidth[index] || col.width,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<InternalBusinessUser>).width,
      onResize: handleResize(index, setUpdatedColumnWidth),
    }),
  }));
  const analytics = useAnalytics();
  const navigate = useNavigate();
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
        data: response.data,
        success: true,
        total: response.total,
      };
    },
    [analytics, api],
  );

  return (
    <>
      <Table<InternalBusinessUser, TableListPagination>
        form={{
          labelWrap: true,
        }}
        rowKey="userId"
        search={{
          labelWidth: 120,
        }}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        className={styles.table}
        style={{ tableLayout: 'fixed' }}
        scroll={{ x: 1300 }}
        request={request}
        columns={mergeColumns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-list-table',
        }}
      />
      <Drawer
        width={960}
        visible={!isInit(currentItem)}
        onClose={() => {
          navigate('/users/list/business/all', { replace: true });
        }}
        closable={false}
      >
        <AsyncResourceRenderer resource={currentItem}>
          {(user) => user?.legalEntity && <BusinessUserDetails user={user} columns={columns} />}
        </AsyncResourceRenderer>
      </Drawer>
    </>
  );
};

const ConsumerUsersTab = (props: { id?: string }) => {
  const [currentItem, setCurrentItem] = useState<AsyncResource<InternalConsumerUser>>(init());
  const isPulseEnabled = useFeature('PULSE');
  const api = useApi();
  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: number]: number;
  }>({});
  const { id: userId } = props;
  const currentUserId = isSuccess(currentItem) ? currentItem.value.userId : null;
  useEffect(() => {
    if (userId == null || userId === 'all') {
      setCurrentItem(init());
      return function () {};
    }
    if (currentUserId === userId) {
      return function () {};
    }
    setCurrentItem(loading());
    let isCanceled = false;
    api
      .getConsumerUsersItem({
        userId,
      })
      .then((user) => {
        if (isCanceled) {
          return;
        }
        setCurrentItem(success(user));
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        // todo: i18n
        let message = 'Unknown error';
        if (e instanceof ApiException && e.code === 404) {
          message = `Unable to find user by id "${userId}"`;
        } else if (e instanceof Error && e.message) {
          message = e.message;
        }
        setCurrentItem(failed(message));
      });
    return () => {
      isCanceled = true;
    };
  }, [currentUserId, userId, api]);

  const columns: ProColumns<InternalConsumerUser>[] = getConsumerUserColumns((user) =>
    setCurrentItem(success(user)),
  );

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

  const mergeColumns: ProColumns<InternalConsumerUser>[] = columns.map((col, index) => ({
    ...col,
    width: updatedColumnWidth[index] || col.width,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<InternalConsumerUser>).width,
      onResize: handleResize(index, setUpdatedColumnWidth),
    }),
  }));

  const analytics = useAnalytics();
  const navigate = useNavigate();
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
        data: response.data,
        success: true,
        total: response.total,
      };
    },
    [analytics, api],
  );

  return (
    <>
      <Table<InternalConsumerUser, TableListPagination>
        form={{
          labelWrap: true,
        }}
        rowKey="userId"
        search={{
          labelWidth: 120,
        }}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        className={styles.table}
        scroll={{ x: 500 }}
        request={request}
        columns={mergeColumns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-list',
        }}
      />
      <Drawer
        width={960}
        visible={!isInit(currentItem)}
        onClose={() => {
          navigate('/users/list/consumer/all', { replace: true });
        }}
        closable={false}
      >
        <AsyncResourceRenderer resource={currentItem}>
          {(user) => <ConsumerUserDetails user={user} columns={columns} />}
        </AsyncResourceRenderer>
      </Drawer>
    </>
  );
};

const TableList = () => {
  const { list = 'consumer', id } = useParams<'list' | 'id'>();
  const navigate = useNavigate();
  const i18n = useI18n();
  const [_, setLocalStorageActiveTab] = useLocalStorageState('user-active-tab', list);
  useEffect(() => {
    setLocalStorageActiveTab(list);
  }, [setLocalStorageActiveTab, list]);
  return (
    <PageWrapper title={i18n('menu.users.lists')}>
      <div className={styles.tab}>
        <Tabs
          type="line"
          activeKey={list}
          destroyInactiveTabPane={true}
          onChange={(key) => {
            navigate(`/users/list/${key}/all`, { replace: true });
          }}
        >
          <Tabs.TabPane tab="Consumer Users" key="consumer">
            <ConsumerUsersTab id={id} />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Business Users" key="business">
            <BusinessUsersTab id={id} />
          </Tabs.TabPane>
        </Tabs>
      </div>
    </PageWrapper>
  );
};

export default TableList;
