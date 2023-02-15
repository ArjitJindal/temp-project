import React from 'react';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import ProTable from '@ant-design/pro-table';
import { RenderExpandIcon } from 'rc-table/lib/interface';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import s from './PermissionTable.module.less';
import Table from '@/components/ui/Table';
import Label from '@/components/library/Label';
import Checkbox from '@/components/library/Checkbox';
import { TableColumn, TableRow } from '@/components/ui/Table/types';
import { PermissionRow, PermissionSubsection } from '@/pages/accounts/Roles/types';

const roleColumns: TableColumn<PermissionRow>[] = [
  { title: 'Feature', dataIndex: 'name', key: 'name', renderText: (text) => sentenceCase(text) },
  { title: 'Actions', dataIndex: 'name', key: 'name', width: 200, render: () => <></> }, // Don't show the text but keep the width.
];

const expandIcon: RenderExpandIcon<TableRow<PermissionRow>> = ({
  record,
  expanded,
  onExpand,
}: {
  record: TableRow<PermissionRow>;
  onExpand: (record: TableRow<PermissionRow>, event: React.MouseEvent<HTMLElement>) => void;
  expanded: boolean;
}) => {
  if (expanded) {
    return (
      <UpOutlined
        onClick={(e) => {
          onExpand(record, e);
        }}
      />
    );
  }
  return (
    <DownOutlined
      onClick={(e) => {
        onExpand(record, e);
      }}
    />
  );
};
export default function PermissionTable({ role, items }: { role: string; items: PermissionRow[] }) {
  return (
    <Table<PermissionRow>
      data={{ items }}
      headerTitle={sentenceCase(role)}
      headerSubtitle={`The following is the default permissions set for the ${sentenceCase(
        role,
      )} role.`}
      rowKey={'name'}
      columns={roleColumns}
      disableExpandedRowPadding
      pagination={false}
      search={false}
      className={s.rolesTable}
      options={{
        reload: false,
        density: false,
        setting: false,
      }}
      bordered={false}
      expandable={{
        defaultExpandAllRows: false,
        expandIcon,

        expandedRowRender: (record) => (
          <ProTable<PermissionSubsection>
            dataSource={record.subsections}
            columns={[
              {
                title: 'Feature',
                key: 'name',
                dataIndex: 'name',
                renderText: (text) => sentenceCase(text),
              },
              {
                title: 'Actions',
                key: 'actions',
                dataIndex: 'actions',
                width: 200,
                render: (dom, subsection) => {
                  return (
                    <div className={s.actions}>
                      {subsection.actions.map((action) => (
                        <Label level={2} label={sentenceCase(action.name)} position={'RIGHT'}>
                          <Checkbox value={action.enabled} isDisabled />
                        </Label>
                      ))}
                    </div>
                  );
                },
              },
            ]}
            className={s.expandedRow}
            showHeader={false}
            headerTitle={false}
            search={false}
            options={false}
            pagination={false}
          />
        ),
      }}
    />
  );
}
