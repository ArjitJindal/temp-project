import React from 'react';
import { Card } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import { EditableProTable, ProColumns } from '@ant-design/pro-table';
import type { CreateListsTableListItem } from './data.d';
import { getActiveLists } from './service';

const StepForm: React.FC<Record<string, any>> = () => {
  const columns: ProColumns<CreateListsTableListItem>[] = [
    {
      title: 'List ID',
      width: 80,
      dataIndex: 'listId',
      fixed: 'left',
      align: 'left',
      search: false,
    },
    {
      title: 'IBAN Number',
      width: 240,
      dataIndex: 'ibanNumber',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      align: 'left',
      width: 240,
      search: false,
      valueType: 'date',
    },
  ];

  return (
    <PageContainer content="Custom lists you have created">
      <Card bordered={false}>
        <>
          <h1>Whitelisted receiver IBANs - Global</h1>
          <EditableProTable<CreateListsTableListItem>
            columns={columns}
            request={getActiveLists}
            scroll={{ x: 1300 }}
            options={false}
            search={false}
            rowKey="key"
            recordCreatorProps={{
              creatorButtonText: 'Add Row',
              'aria-errormessage': 'Please add one row at a time',
            }}
          />
        </>
      </Card>
    </PageContainer>
  );
};

export default StepForm;
