import { Input, Drawer, Tag } from 'antd';
import React, { useState, useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import type { ProDescriptionsItemProps } from '@ant-design/pro-descriptions';
import ProDescriptions from '@ant-design/pro-descriptions';
import { expandedRulesRowRender } from './components/ExpandedRulesRowRender';
import { rule } from './service';
import type { NetworkAnalysisTableListItem, NetworkAnalysisTableListPagination } from './data.d';

const NetworkAnalysisTableList: React.FC = () => {
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const actionRef = useRef<ActionType>();
  const [currentRow, setCurrentRow] = useState<NetworkAnalysisTableListItem>();

  const columns: ProColumns<NetworkAnalysisTableListItem>[] = [
    {
      title: 'Profile Identifier',
      dataIndex: 'name',
      tip: 'Identifier of the profile',
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
      title: 'Transaction ID',
      dataIndex: 'transactionId',
      valueType: 'textarea',
    },
    {
      title: 'Payment method',
      dataIndex: 'paymentMethod',
      valueType: 'textarea',
    },
    {
      title: 'Payout method',
      dataIndex: 'payoutMethod',
      valueType: 'textarea',
    },
    {
      title: 'Rules hit',
      dataIndex: 'rulesHit',
      sorter: true,
      width: 80,
      hideInForm: true,
      renderText: (val: number) => `${val} Rule(s)`,
    },
    {
      title: 'Origin Country',
      dataIndex: 'originCountry',
      valueType: 'textarea',
      width: 80,
    },

    {
      title: 'Destination Country',
      dataIndex: 'destinationCountry',
      valueType: 'textarea',
      width: 80,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      valueType: 'textarea',
    },
    {
      title: 'Sending Currency',
      dataIndex: 'sendingCurrency',
      valueType: 'textarea',
      width: 80,
    },

    {
      title: 'Receiving Currency',
      dataIndex: 'receivingCurrency',
      valueType: 'textarea',
      width: 80,
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      hideInForm: true,
      render: (tags: any) => {
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
      },
    },
    {
      title: 'Transaction time',
      sorter: true,
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      renderFormItem: (item, { defaultRender, ...rest }, form) => {
        const status = form.getFieldValue('status');

        if (`${status}` === '0') {
          return false;
        }

        if (`${status}` === '3') {
          return <Input {...rest} placeholder="请输入异常原因！" />;
        }

        return defaultRender(item);
      },
    },
  ];

  return (
    <PageContainer>
      <ProTable<NetworkAnalysisTableListItem, NetworkAnalysisTableListPagination>
        headerTitle="Transactions"
        actionRef={actionRef}
        rowKey="key"
        search={{
          labelWidth: 120,
        }}
        expandable={{ expandedRowRender: expandedRulesRowRender }}
        request={rule}
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
        {currentRow?.name && (
          <ProDescriptions<NetworkAnalysisTableListItem>
            column={2}
            title={currentRow?.name}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.name,
            }}
            columns={columns as ProDescriptionsItemProps<NetworkAnalysisTableListItem>[]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default NetworkAnalysisTableList;
