import React, { useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { ActionType, ProColumns } from '@ant-design/pro-table';
import { ProFormInstance } from '@ant-design/pro-form';
import type { CreateListsTableListItem } from './data.d';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';

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

  const i18n = useI18n();

  return (
    <PageWrapper
      title={i18n('menu.lists.created-lists')}
      description="Custom lists you have created"
    />
  );
};

export default StepForm;
