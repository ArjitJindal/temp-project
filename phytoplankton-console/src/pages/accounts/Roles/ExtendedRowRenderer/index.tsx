import { sentenceCase } from '@antv/x6/es/util/string/format';
import React from 'react';
import s from './index.module.less';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { PermissionRow, PermissionSubsection } from '@/pages/accounts/Roles/types';
import Label from '@/components/library/Label';
import Checkbox from '@/components/library/Checkbox';
import Table from '@/components/library/Table';
import { useFeatures } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Feature, Permission } from '@/apis';

interface Props {
  record: PermissionRow;
  onChange?: (key: Permission, enabled: boolean) => void;
}

export default function ExtendedRowRenderer(props: Props) {
  const { record, onChange } = props;
  const features = useFeatures();
  const helper = new ColumnHelper<PermissionSubsection>();
  const columns = helper.list([
    helper.display({
      title: 'Feature',
      id: 'name',
      render: (subsection) => {
        return (
          <span
            key={subsection.name}
            className={
              featureEnabled(features, subsection.section, subsection.name) ? undefined : s.disabled
            }
          >
            {sentenceCase(subsection.name)}
          </span>
        );
      },
    }),
    helper.display({
      title: 'Actions',
      id: 'actions',
      defaultWidth: 200,
      render: (subsection) => {
        return (
          <div className={s.actions} key={subsection.name}>
            {subsection.actions.map((action) => (
              <Label
                level={action.name === 'read' ? 2 : !onChange ? 3 : 2}
                label={sentenceCase(action.name)}
                position={'RIGHT'}
                key={action.key}
              >
                <Checkbox
                  value={action.enabled}
                  isDisabled={!onChange}
                  onChange={(newValue) => onChange && onChange(action.key, !!newValue)}
                />
              </Label>
            ))}
          </div>
        );
      },
    }),
  ]);
  return (
    <Table<PermissionSubsection>
      rowKey="name"
      columns={columns}
      toolsOptions={false}
      data={{
        items: record.subsections,
      }}
    />
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
