import React, { useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { files } from './service';
import type { TableListItem, TableListPagination } from './data.d';
import { Button, Tag, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { TransactionImportRequestFormatEnum, TransactionImportRequestTypeEnum } from '@/apis';
import { useApi } from '@/api';

function getStatusColor(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'processing';
    case 'IMPORTED':
      return 'success';
    case 'FAILED':
      return 'error';
  }
  return 'warning';
}

const TableList: React.FC = () => {
  const api = useApi();
  const actionRef = useRef<ActionType>();

  const columns: ProColumns<TableListItem>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      tip: 'File identifier',
      render: (dom) => {
        return <a>{dom}</a>;
      },
    },
    {
      title: 'Filename',
      dataIndex: 'filename',
      valueType: 'text',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: 'Total Transactions',
      dataIndex: 'totalTransactions',
      valueType: 'digit',
    },
    {
      title: 'Imported Transactions',
      dataIndex: 'importedTransactions',
      valueType: 'digit',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      valueType: 'text',
      render: (status: any) => {
        return (
          <span>
            <Tag color={getStatusColor(status)}>{status}</Tag>
          </span>
        );
      },
    },
  ];

  return (
    <PageContainer>
      <ProTable<TableListItem, TableListPagination>
        headerTitle="Files"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        request={files}
        columns={columns}
        toolBarRender={() => {
          return [
            <Upload
              accept=".csv"
              key="import"
              showUploadList={false}
              customRequest={async ({ file, filename }) => {
                // 1. Get S3 presigned URL
                const hideUploadMessage = message.loading('Uploading...', 0);
                const { presignedUrl, s3Key } = await api.postTransactionsGetPresignedUrl();

                // 2. Upload file to S3 directly
                await axios.put(presignedUrl, file, {
                  headers: {
                    'Content-Disposition': `attachment; filename="${filename}"`,
                  },
                });
                hideUploadMessage();

                // 3. Start importing
                const hideImportMessage = message.loading('Importing...', 0);
                try {
                  const { importedTransactions } = await api.postTransactionsImport({
                    transactionImportRequest: {
                      type: TransactionImportRequestTypeEnum.Transaction,
                      format: TransactionImportRequestFormatEnum.ShPayment,
                      s3Key,
                    },
                  });
                  message.success(`Imported ${importedTransactions} transactions`);
                } catch (error) {
                  message.error(error as any);
                } finally {
                  hideImportMessage();
                }
              }}
            >
              <Button icon={<UploadOutlined />}>Import</Button>
            </Upload>,
          ];
        }}
      />
    </PageContainer>
  );
};

export default TableList;
