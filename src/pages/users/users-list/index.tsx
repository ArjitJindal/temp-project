import { Drawer, Tabs, Tag } from 'antd';
import { useLocalStorageState } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import moment from 'moment';
import { RouteMatch, useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import type { TableListPagination } from './data.d';
import styles from './UsersList.module.less';
import UserRiskTag from './components/UserRiskTag';
import { ConsumerUserDetails } from './components/ConsumerUserDetails';
import { BusinessUserDetails } from './components/BusinessUserDetails';
import Table from '@/components/ui/Table';
import { useApi } from '@/api';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Amount, ApiException, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { getFullName } from '@/utils/api/users';
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
import { useI18n } from '@/locales';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';

const convertToDateString = (createdTimestamp: number) =>
  moment(createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);

const createCurrencyStringFromAmount = (amount: Amount | undefined) => {
  return amount ? `${amount.amountValue} ${amount.amountCurrency}` : '-';
};

const BusinessUsersTab = (props: { id?: string }) => {
  const actionRef = useRef<ActionType>();
  const [currentItem, setCurrentItem] = useState<AsyncResource<InternalBusinessUser>>(init());
  const api = useApi();

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

  const columns: ProColumns<InternalBusinessUser>[] = [
    {
      title: 'User ID',
      dataIndex: 'userId',
      tip: 'Unique identification of user.',
      render: (dom, entity) => {
        // todo: fix style
        return (
          <Link
            to={`/users/list/business/${entity.userId}`}
            onClick={() => {
              setCurrentItem(success(entity));
            }}
            style={{ color: '@fr-colors-brandBlue' }}
            replace
          >
            {entity.userId}
          </Link>
        );
      },
    },
    {
      title: 'Legal Name',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyGeneralDetails.legalName;
      },
      valueType: 'textarea',
    },
    {
      title: 'Industry',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyGeneralDetails.businessIndustry;
      },
      valueType: 'textarea',
    },
    {
      title: 'Expected Transaction Amount Per Month',
      hideInSearch: true,
      render: (dom, entity) => {
        return createCurrencyStringFromAmount(
          entity.legalEntity.companyFinancialDetails?.expectedTransactionAmountPerMonth,
        );
      },
      valueType: 'textarea',
    },
    {
      title: 'Expected Turnover Amount Per Month',
      hideInSearch: true,
      render: (dom, entity) => {
        return createCurrencyStringFromAmount(
          entity.legalEntity.companyFinancialDetails?.expectedTurnoverPerMonth,
        );
      },
      valueType: 'textarea',
    },
    {
      title: 'Maximum Daily Transaction Limit',
      hideInSearch: true,
      dataIndex: 'maximumDailyTransactionLimit',
      valueType: 'textarea',
    },
    {
      title: 'Registration Identifier',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyRegistrationDetails?.registrationIdentifier;
      },
      valueType: 'textarea',
    },
    {
      title: 'Registration Country',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyRegistrationDetails?.registrationCountry;
      },
      valueType: 'textarea',
    },
    {
      title: 'Creation time',
      sorter: true,
      dataIndex: 'createdTimestamp',
      valueType: 'dateTimeRange',
      render: (_, user) => {
        return moment(user.createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
      },
    },
  ];

  const analytics = useAnalytics();
  const navigate = useNavigate();

  return (
    <>
      <Table<InternalBusinessUser, TableListPagination>
        form={{
          labelWrap: true,
        }}
        headerTitle="Business Users"
        actionRef={actionRef}
        rowKey="userId"
        search={{
          labelWidth: 120,
        }}
        request={async (params) => {
          const { pageSize, current, userId, createdTimestamp } = params;
          const [response, time] = await measure(() =>
            api.getBusinessUsersList({
              limit: pageSize!,
              skip: (current! - 1) * pageSize!,
              afterTimestamp: createdTimestamp ? moment(createdTimestamp[0]).valueOf() : 0,
              beforeTimestamp: createdTimestamp
                ? moment(createdTimestamp[1]).valueOf()
                : Date.now(),
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
        }}
        columns={columns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-list-table',
        }}
      />
      <Drawer
        width={800}
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
  const actionRef = useRef<ActionType>();
  const [currentItem, setCurrentItem] = useState<AsyncResource<InternalConsumerUser>>(init());
  const isPulseEnabled = useFeature('PULSE');
  const api = useApi();
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

  const columns: ProColumns<InternalConsumerUser>[] = [
    {
      title: 'User ID',
      dataIndex: 'userId',
      tip: 'Unique identification of user.',
      render: (dom, entity) => {
        // todo: fix style
        return (
          <Link
            to={`/users/list/consumer/${entity.userId}`}
            onClick={() => {
              setCurrentItem(success(entity));
            }}
            style={{ color: '@fr-colors-brandBlue' }}
            replace
          >
            {entity.userId}
          </Link>
        );
      },
    },
    {
      title: 'Name',
      hideInSearch: true,
      render: (dom, entity) => {
        return getFullName(entity.userDetails);
      },
      valueType: 'textarea',
    },
    {
      title: 'Date of Birth',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.userDetails?.dateOfBirth;
      },
      valueType: 'textarea',
    },
    {
      title: 'Country of residence',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.userDetails?.countryOfResidence;
      },
      valueType: 'textarea',
    },
    {
      title: 'Country of nationality',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.userDetails?.countryOfNationality;
      },
      valueType: 'textarea',
    },
    {
      title: 'KYC Status',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.kycStatusDetails?.status;
      },
      valueType: 'textarea',
    },
    {
      title: 'KYC Status Reason',
      hideInSearch: true,
      hideInTable: true,
      render: (dom, entity) => {
        return entity.kycStatusDetails?.statusReason;
      },
      valueType: 'textarea',
    },
    {
      title: 'User Status',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.userStatusDetails?.status;
      },
      valueType: 'textarea',
    },
    {
      title: 'User Status Reason',
      hideInSearch: true,
      hideInTable: true,
      render: (dom, entity) => {
        return entity.userStatusDetails?.statusReason;
      },
      valueType: 'textarea',
    },
    {
      title: 'Tags',
      hideInSearch: true,
      dataIndex: 'tags',
      hideInForm: true,
      render: (tags: any) => {
        if (tags instanceof Array) {
          return (
            <span>
              <Tag color={'cyan'}>
                {tags?.map((tag: any) => {
                  const key = Object.keys(tag)[0];
                  return (
                    <span>
                      {key}: <span style={{ fontWeight: 700 }}>{tag[key]}</span>
                    </span>
                  );
                })}
              </Tag>
            </span>
          );
        }
      },
    },
    {
      title: 'Created time',
      sorter: (a, b) => a.createdTimestamp - b.createdTimestamp,
      dataIndex: 'createdTimestamp',
      valueType: 'dateTimeRange',
      render: (_, user) => {
        return convertToDateString(user.createdTimestamp);
      },
    },
  ];
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
  const navigate = useNavigate();

  return (
    <>
      <Table<InternalConsumerUser, TableListPagination>
        form={{
          labelWrap: true,
        }}
        headerTitle="Consumer Users"
        actionRef={actionRef}
        rowKey="userId"
        search={{
          labelWidth: 120,
        }}
        request={async (params) => {
          const { pageSize, current, userId, createdTimestamp } = params;
          const [response, time] = await measure(() =>
            api.getConsumerUsersList({
              limit: pageSize!,
              skip: (current! - 1) * pageSize!,
              afterTimestamp: createdTimestamp ? moment(createdTimestamp[0]).valueOf() : 0,
              beforeTimestamp: createdTimestamp
                ? moment(createdTimestamp[1]).valueOf()
                : Date.now(),
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
        }}
        columns={columns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-list',
        }}
      />
      <Drawer
        width={800}
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
