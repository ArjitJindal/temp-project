import { startCase } from 'lodash';
import React from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
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
            className={featureEnabled(features, subsection.section) ? undefined : s.disabled}
          >
            {humanizeAuto(subsection.name)}
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
                label={startCase(action.name)}
                position={'RIGHT'}
                key={action.key}
                testId={action.key}
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
function featureEnabled(features: Feature[], section: string): boolean {
  if (section == 'simulator' && !features.find((f) => f == 'SIMULATOR')) {
    return false;
  }
  return true;
}
