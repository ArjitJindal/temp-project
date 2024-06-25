import React from 'react';
import { startCase } from 'lodash';
import s from './PermissionTable.module.less';
import Table from '@/components/library/Table';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { PermissionRow } from '@/pages/accounts/Roles/types';
import { Permission } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import ExtendedRowRenderer from '@/pages/accounts/Roles/ExtendedRowRenderer';

const helper = new ColumnHelper<PermissionRow>();
const roleColumns: TableColumn<PermissionRow>[] = helper.list([
  helper.derived<string>({
    id: 'name',
    title: 'Feature',
    value: (item) => startCase(item.name),
  }),
]);

interface Props {
  items: PermissionRow[];
  tableRef?: React.Ref<TableRefType>;
  onChange?: (key: Permission, enabled: boolean) => void;
  onExpandedChange?: (isAllExpanded: boolean) => void;
}

export default function PermissionTable(props: Props) {
  const { items, onChange, tableRef, onExpandedChange } = props;

  return (
    <div className={s.rolePermissionTable}>
      <Table<PermissionRow>
        innerRef={tableRef}
        data={{ items }}
        rowKey={'name'}
        columns={roleColumns}
        pagination={false}
        toolsOptions={false}
        onExpandedMetaChange={({ isAllExpanded }) => onExpandedChange?.(isAllExpanded)}
        renderExpanded={(record) => {
          return <ExtendedRowRenderer record={record} onChange={onChange} />;
        }}
      />
    </div>
  );
}
