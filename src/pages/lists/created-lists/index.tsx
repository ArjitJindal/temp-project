import React, { useRef } from 'react';
import { Card } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import { ActionType, EditableProTable, ProColumns } from '@ant-design/pro-table';
import { ProFormInstance } from '@ant-design/pro-form';
import type { CreateListsTableListItem } from './data.d';
import { getActiveLists } from './service';

const StepForm: React.FC<Record<string, any>> = () => {
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance<any>>();

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
    {
      title: 'Edit',
      valueType: 'option',
      render: (_, row) => [
        <a
          key="delete"
          onClick={() => {
            const tableDataSource = formRef.current?.getFieldValue(
              'table',
            ) as CreateListsTableListItem[];
            formRef.current?.setFieldsValue({
              table: tableDataSource.filter((item) => item.listId !== row?.listId),
            });
          }}
        >
          Delete
        </a>,
        <a
          key="edit"
          onClick={() => {
            actionRef.current?.startEditable(row.listId);
          }}
        >
          Edit
        </a>,
      ],
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
            actionRef={actionRef}
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
