import { Drawer, Tag, Tabs, Table } from 'antd';
import React, { useState, useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import type { ProDescriptionsItemProps } from '@ant-design/pro-descriptions';
import ProDescriptions from '@ant-design/pro-descriptions';
import { Link } from 'umi';
import { customerUsers, businessUsers } from './service';
import type { CustomerUsersListItem, BusinessUsersListItem, TableListPagination } from './data.d';
import { tableListDataSource } from './_transactionsMock';
import { useApi } from '@/api';
import { User } from '@/apis';

function createUserTransactions() {
  return Array.from(Array(10).keys()).map(() => {
    const index = Math.floor(Math.random() * tableListDataSource.length);
    return {
      transactionId: tableListDataSource[index].transactionId,
      transactionTime: tableListDataSource[index].createdAt.toDateString(),
      amount: `${tableListDataSource[index].amount} ${tableListDataSource[index].sendingCurrency}`,
    };
  });
}

const BusinessUsersTab: React.FC = () => {
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const actionRef = useRef<ActionType>();
  const [currentRow, setCurrentRow] = useState<BusinessUsersListItem>();
  const columns: ProColumns<BusinessUsersListItem>[] = [
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
      dataIndex: 'name',
      valueType: 'textarea',
    },
    {
      title: 'Industry',
      dataIndex: 'businessIndustry',
      valueType: 'textarea',
    },
    {
      title: 'Expected Transaction Amount Per Month',
      dataIndex: 'expectedTransactionAmountPerMonth',
      valueType: 'textarea',
    },
    {
      title: 'Expected Turnover Amount Per Month',
      dataIndex: 'expectedTurnoverPerMonth',
      valueType: 'textarea',
    },
    {
      title: 'Maximum Daily Transaction Limit',
      dataIndex: 'maximumDailyTransactionLimit',
      valueType: 'textarea',
    },
    {
      title: 'Registration Identifier',
      dataIndex: 'registrationIdentifier',
      valueType: 'textarea',
    },
    {
      title: 'Registration Country',
      dataIndex: 'registrationCountry',
      valueType: 'textarea',
    },
    {
      title: 'Created time',
      sorter: true,
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ProTable<BusinessUsersListItem, TableListPagination>
        headerTitle="Business Users"
        actionRef={actionRef}
        rowKey="key"
        search={{
          labelWidth: 120,
        }}
        request={businessUsers}
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
        {currentRow?.name && (
          <>
            <ProDescriptions<BusinessUsersListItem>
              column={2}
              title={currentRow?.name}
              request={async () => ({
                data: currentRow || {},
              })}
              params={{
                id: currentRow?.name,
              }}
              columns={columns as ProDescriptionsItemProps<BusinessUsersListItem>[]}
            />
            Transaction History:
            <Table
              dataSource={createUserTransactions()}
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
                  dataIndex: 'transactionTime',
                  key: 'transactionTime',
                },
                {
                  title: 'Amount',
                  dataIndex: 'amount',
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
          console.log(`TAGZ`);
          console.log(tags);
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

          console.log(`LOGGING BIATCHE: `);
          console.log(JSON.stringify(response.data));
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
            <Table
              dataSource={createUserTransactions()}
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
                  dataIndex: 'transactionTime',
                  key: 'transactionTime',
                },
                {
                  title: 'Amount',
                  dataIndex: 'amount',
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
