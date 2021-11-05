import { Tag } from 'antd';
import React from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { expandedRulesRowRender } from './components/ExpandedRulesRowRender';
import { networkAnalysis } from './service';
import type { NetworkAnalysisTableListItem, NetworkAnalysisTableListPagination } from './data.d';

const NetworkAnalysisTableList: React.FC = () => {
  const columns: ProColumns<NetworkAnalysisTableListItem>[] = [
    {
      title: 'Profile Identifiers',
      dataIndex: 'name',
      tip: 'Identifiers of the profile',
      render: (ids: any) => {
        return (
          <span>
            {ids?.map((tag: any) => {
              console.log('TAG: \n');
              console.log(tag);
              return (
                <Tag color={'geekblue'}>
                  <span>{tag}</span>{' '}
                </Tag>
              );
            })}
          </span>
        );
      },
    },
    {
      title: 'Transaction IDs',
      dataIndex: 'transactionIds',
      render: (ids: any) => {
        return (
          <span>
            {ids?.map((tag: any) => {
              return (
                <Tag color={'blue'}>
                  <span>{tag}</span>
                </Tag>
              );
            })}
          </span>
        );
      },
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
  ];

  return (
    <PageContainer>
      <ProTable<NetworkAnalysisTableListItem, NetworkAnalysisTableListPagination>
        headerTitle="Transactions"
        rowKey="key"
        search={{
          labelWidth: 120,
        }}
        expandable={{ expandedRowRender: expandedRulesRowRender }}
        request={networkAnalysis}
        columns={columns}
      />
    </PageContainer>
  );
};

export default NetworkAnalysisTableList;
