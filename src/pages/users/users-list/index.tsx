import { Drawer, Tag, Tabs, Table } from 'antd';
import React, { useState, useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import type { ProDescriptionsItemProps } from '@ant-design/pro-descriptions';
import ProDescriptions from '@ant-design/pro-descriptions';
import { Link } from 'umi';
import type { TableListPagination } from './data.d';
import { useApi } from '@/api';
import {
  Amount,
  Business,
  TransactionAmountDetails,
  TransactionCaseManagement,
  User,
} from '@/apis';

const createCurrencyStringFromAmount = (amount: Amount | undefined) => {
  return amount ? `${amount.amountValue} ${amount.amountCurrency}` : '-';
};

const createCurrencyStringFromTransactionAmount = (
  amount: TransactionAmountDetails | undefined,
) => {
  return amount ? `${amount.transactionAmount} ${amount.transactionCurrency}` : '-';
};

const BusinessUsersTab: React.FC = () => {
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const actionRef = useRef<ActionType>();
  const [currentRow, setCurrentRow] = useState<Business>();
  const api = useApi();

  const columns: ProColumns<Business>[] = [
    {
      title: 'User ID',
      dataIndex: 'userId',
      tip: 'Unique identification of user.',
      render: (dom, entity) => {
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {dom}
          </a>
        );
      },
    },
    {
      title: 'Legal Name',
      render: (dom, entity) => {
        return entity.legalEntity.companyGeneralDetails.legalName;
      },
      valueType: 'textarea',
    },
    {
      title: 'Industry',
      render: (dom, entity) => {
        return entity.legalEntity.companyGeneralDetails.businessIndustry;
      },
      valueType: 'textarea',
    },
    {
      title: 'Expected Transaction Amount Per Month',
      render: (dom, entity) => {
        return createCurrencyStringFromAmount(
          entity.legalEntity.companyFinancialDetails?.expectedTransactionAmountPerMonth,
        );
      },
      valueType: 'textarea',
    },
    {
      title: 'Expected Turnover Amount Per Month',
      render: (dom, entity) => {
        return createCurrencyStringFromAmount(
          entity.legalEntity.companyFinancialDetails?.expectedTurnoverPerMonth,
        );
      },
      valueType: 'textarea',
    },
    {
      title: 'Maximum Daily Transaction Limit',
      dataIndex: 'maximumDailyTransactionLimit',
      valueType: 'textarea',
    },
    {
      title: 'Registration Identifier',
      render: (dom, entity) => {
        return entity.legalEntity.companyRegistrationDetails?.registrationIdentifier;
      },
      valueType: 'textarea',
    },
    {
      title: 'Registration Country',
      render: (dom, entity) => {
        return entity.legalEntity.companyRegistrationDetails?.registrationCountry;
      },
      valueType: 'textarea',
    },
    {
      title: 'Created time',
      sorter: true,
      dataIndex: 'createdTimestamp',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ProTable<Business, TableListPagination>
        headerTitle="Business Users"
        actionRef={actionRef}
        rowKey="key"
        search={{
          labelWidth: 120,
        }}
        request={async (params) => {
          const response = await api.getBusinessUsersList({
            limit: params.pageSize!,
            skip: (params.current! - 1) * params.pageSize!,
            beforeTimestamp: Date.now(),
          });

          return {
            data: response.data,
            success: true,
            total: response.total,
          };
        }}
        columns={columns}
      />
      <Drawer
        width={800}
        visible={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.legalEntity && (
          <>
            <ProDescriptions<Business>
              column={2}
              title={currentRow?.legalEntity.companyGeneralDetails.legalName}
              request={async () => ({
                data: currentRow || {},
              })}
              params={{
                id: currentRow?.legalEntity.companyGeneralDetails.legalName,
              }}
              columns={columns as ProDescriptionsItemProps<Business>[]}
            />
            Transaction History:
            <ProTable<TransactionCaseManagement>
              request={async (params) => {
                const response = await api.getTransactionsPerUserList({
                  limit: params.pageSize!,
                  skip: (params.current! - 1) * params.pageSize!,
                  beforeTimestamp: Date.now(),
                  userId: currentRow?.userId,
                });

                return {
                  data: response.data,
                  success: true,
                  total: response.total,
                };
              }}
              columns={[
                {
                  title: 'Transaction ID',
                  dataIndex: 'transactionId',
                  key: 'transactionId',
                  render: (dom, entity) => {
                    return (
                      <Link to={`/transactions/transactions-list/${entity.transactionId}`}>
                        {dom}
                      </Link>
                    );
                  },
                },
                {
                  title: 'Transaction time',
                  dataIndex: 'timestamp',
                  key: 'transactionTime',
                },
                {
                  title: 'Sending Amount',
                  render: (dom, entity) => {
                    return `${createCurrencyStringFromTransactionAmount(
                      entity.sendingAmountDetails,
                    )}`;
                  },
                  key: 'amount',
                },

                {
                  title: 'Receiving Amount',
                  render: (dom, entity) => {
                    return `${createCurrencyStringFromTransactionAmount(
                      entity.receivingAmountDetails,
                    )}`;
                  },
                  key: 'amount',
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </>
  );
};

const ConsumerUsersTab: React.FC = () => {
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const actionRef = useRef<ActionType>();
  const [currentRow, setCurrentRow] = useState<User>();

  const api = useApi();

  const columns: ProColumns<User>[] = [
    {
      title: 'User ID',
      dataIndex: 'userId',
      tip: 'Unique identification of user.',
      render: (dom, entity) => {
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {dom}
          </a>
        );
      },
    },
    {
      title: 'Name',
      render: (dom, entity) => {
        return `${entity.userDetails?.name.firstName} ${entity.userDetails?.name.middleName} ${entity.userDetails?.name.lastName}`;
      },
      valueType: 'textarea',
    },
    {
      title: 'Age',
      render: (dom, entity) => {
        return entity.userDetails?.age;
      },
      valueType: 'digit',
    },
    {
      title: 'Country of residence',
      render: (dom, entity) => {
        return entity.userDetails?.countryOfResidence;
      },
      valueType: 'textarea',
    },
    {
      title: 'Country of nationality',
      render: (dom, entity) => {
        return entity.userDetails?.countryOfNationality;
      },
      valueType: 'textarea',
    },
    {
      title: 'Tags',
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
      sorter: true,
      dataIndex: 'createdTimestamp',
      valueType: 'dateTime',
    },
  ];
  return (
    <>
      <ProTable<User, TableListPagination>
        headerTitle="Consumer Users"
        actionRef={actionRef}
        rowKey="key"
        search={{
          labelWidth: 120,
        }}
        request={async (params) => {
          const response = await api.getConsumerUsersList({
            limit: params.pageSize!,
            skip: (params.current! - 1) * params.pageSize!,
            beforeTimestamp: Date.now(),
          });

          return {
            data: response.data,
            success: true,
            total: response.total,
          };
        }}
        columns={columns}
      />
      <Drawer
        width={600}
        visible={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.userDetails.name && (
          <>
            <ProDescriptions<User>
              column={2}
              title={`${currentRow?.userDetails.name.firstName} ${currentRow?.userDetails.name.middleName} ${currentRow?.userDetails.name.lastName}`}
              request={async () => ({
                data: currentRow || {},
              })}
              params={{
                id: `${currentRow?.userDetails.name.firstName} ${currentRow?.userDetails.name.middleName} ${currentRow?.userDetails.name.lastName}`,
              }}
              columns={columns as ProDescriptionsItemProps<User>[]}
            />
            Transaction History:
            <ProTable<TransactionCaseManagement>
              request={async (params) => {
                const response = await api.getTransactionsPerUserList({
                  limit: params.pageSize!,
                  skip: (params.current! - 1) * params.pageSize!,
                  beforeTimestamp: Date.now(),
                  userId: currentRow?.userId,
                });

                return {
                  data: response.data,
                  success: true,
                  total: response.total,
                };
              }}
              columns={[
                {
                  title: 'Transaction ID',
                  dataIndex: 'transactionId',
                  key: 'transactionId',
                  render: (dom, entity) => {
                    return (
                      <Link to={`/transactions/transactions-list/${entity.transactionId}`}>
                        {dom}
                      </Link>
                    );
                  },
                },
                {
                  title: 'Transaction time',
                  dataIndex: 'timestamp',
                  key: 'transactionTime',
                },
                {
                  title: 'Sending Amount',
                  render: (dom, entity) => {
                    return `${createCurrencyStringFromTransactionAmount(
                      entity.sendingAmountDetails,
                    )}`;
                  },
                  key: 'amount',
                },

                {
                  title: 'Receiving Amount',
                  render: (dom, entity) => {
                    return `${createCurrencyStringFromTransactionAmount(
                      entity.receivingAmountDetails,
                    )}`;
                  },
                  key: 'amount',
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </>
  );
};

const TableList: React.FC = () => {
  return (
    <PageContainer>
      <Tabs type="line">
        <Tabs.TabPane tab="Consumer Users" key="consumer">
          <ConsumerUsersTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Business Users" key="business">
          <BusinessUsersTab />
        </Tabs.TabPane>
      </Tabs>
    </PageContainer>
  );
};

export default TableList;
