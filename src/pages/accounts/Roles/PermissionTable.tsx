import React, { useState } from 'react';
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
import { useFeatures } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Feature } from '@/apis';
import Button from '@/components/library/Button';

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
  const features = useFeatures();
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  const allExpanded = expandedRows.length === items.length;
  return (
    <>
      <Table<PermissionRow>
        data={{ items }}
        headerTitle={sentenceCase(role)}
        headerSubtitle={
          <>
            <div>{`The following is the default permissions set for the ${sentenceCase(
              role,
            )} role.`}</div>
            <Button
              type={'SECONDARY'}
              style={{ marginTop: '10px', marginLeft: '3px' }}
              onClick={() => {
                if (allExpanded) {
                  setExpandedRows([]);
                } else {
                  setExpandedRows(items.map((i) => i.name));
                }
              }}
            >
              {allExpanded ? 'Collapse all' : 'Show all'}
            </Button>
          </>
        }
        rowKey={'name'}
        columns={roleColumns}
        disableExpandedRowPadding
        pagination={false}
        search={false}
        controlsHeader={[() => <h1>hello</h1>]}
        className={s.rolesTable}
        options={{
          reload: false,
          density: false,
          setting: false,
        }}
        bordered={false}
        expandable={{
          showExpandColumn: true,
          defaultExpandAllRows: false,
          expandRowByClick: true,
          expandedRowKeys: expandedRows,
          onExpand: (expanded, record) => {
            let newRows: string[] = expandedRows;
            if (expanded && expandedRows.indexOf(record.entityKey) === -1) {
              newRows = expandedRows.concat(record.entityKey);
            }
            if (!expanded) {
              newRows = expandedRows.filter((r) => r !== record.entityKey);
            }
            setExpandedRows(newRows);
          },
          expandIcon,
          expandedRowRender: (record) => (
            <ProTable<PermissionSubsection>
              key={record.entityKey}
              dataSource={record.subsections}
              columns={[
                {
                  title: 'Feature',
                  key: 'name',
                  dataIndex: 'name',
                  render: (dom, subsection) => {
                    return (
                      <span
                        className={
                          featureEnabled(features, subsection.section, subsection.name)
                            ? undefined
                            : s.disabled
                        }
                      >
                        {sentenceCase(subsection.name)}
                      </span>
                    );
                  },
                  readonly: true,
                  disable: true,
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
                          <Label
                            level={2}
                            label={sentenceCase(action.name)}
                            position={'RIGHT'}
                            key={action.name}
                          >
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
    </>
  );
}

// Check permissions against feature flags.
function featureEnabled(features: Feature[], section: string, subsection: string): boolean {
  if (subsection == 'import' && !features.find((f) => f == 'IMPORT_FILES')) {
    return false;
  }
  if (section == 'simulator' && !features.find((f) => (f as string) == 'SIMULATOR')) {
    return false;
  }
  return true;
}
