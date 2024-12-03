import React, { useState } from 'react';
import { Radio } from 'antd';
import s from './styles.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import SettingsCard from '@/components/library/SettingsCard';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import TextInput from '@/components/library/TextInput';
import { StatePair } from '@/utils/state';
import Alert from '@/components/library/Alert';
import { useHasPermissions } from '@/utils/user-utils';
import { ConsoleTag, ConsoleTagTypeEnum } from '@/apis';
import Select from '@/components/library/Select';
interface CommonItem {
  rowKey: string;
  key: string;
  tagType: ConsoleTagTypeEnum;
  options?: string[];
}

interface ExistingItem extends CommonItem {
  type: 'EXISTING';
}

interface NewItem extends CommonItem {
  type: 'NEW';
}

type Item = ExistingItem | NewItem;

interface ExternalState {
  newStateDetails: StatePair<Item | undefined>;
  onAdd: (tag: ConsoleTag) => void;
  canEdit: boolean;
}

const helper = new ColumnHelper<Item>();
const columns = helper.list([
  helper.display({
    title: 'Key',
    defaultWidth: 300,
    render: (item, context) => {
      const externalState = context.external as ExternalState;
      const [newState, setNewState] = externalState.newStateDetails;
      const canEdit = externalState.canEdit;
      if (item.type === 'NEW') {
        return (
          <TextInput
            value={newState?.key}
            onChange={(e) =>
              setNewState({
                key: e ?? '',
                type: 'NEW',
                rowKey: 'new',
                tagType: newState?.tagType ?? 'STRING',
              })
            }
            isDisabled={!canEdit}
          />
        );
      } else {
        return <>{item.key}</>;
      }
    },
  }),
  helper.display({
    title: 'Type',
    defaultWidth: 300,
    render: (item, context) => {
      const externalState = context.external as ExternalState;
      const [newState, setNewState] = externalState.newStateDetails;

      return (
        <Radio.Group
          value={newState?.tagType ?? item.tagType}
          disabled={item.type !== 'NEW'}
          onChange={(e) => {
            setNewState({
              type: 'NEW',
              rowKey: 'new',
              key: newState?.key ?? '',
              tagType: e.target.value,
            });
          }}
        >
          <Radio value="STRING">String</Radio>
          <Radio value="ENUM">Enum</Radio>
        </Radio.Group>
      );
    },
  }),
  helper.display({
    title: 'Options',
    defaultWidth: 300,
    render: (item, context) => {
      const externalState = context.external as ExternalState;
      const [newState, setNewState] = externalState.newStateDetails;
      const canEdit = externalState.canEdit;
      if (item.type === 'NEW' && newState?.tagType === 'ENUM') {
        return (
          <Select
            mode="TAGS"
            className={s.options}
            isDisabled={item.type !== 'NEW' || !canEdit}
            options={
              item.options?.map((option) => ({
                label: option,
                value: option,
              })) ?? []
            }
            value={newState?.options}
            onChange={(e) => {
              setNewState({
                type: 'NEW',
                rowKey: 'new',
                key: newState?.key ?? '',
                tagType: newState?.tagType ?? 'ENUM',
                options: e ?? [],
              });
            }}
          />
        );
      }
      return item.tagType === 'ENUM' ? <>{item.options?.join(', ')}</> : <>-</>;
    },
  }),
  helper.display({
    title: 'Action',
    defaultWidth: 300,
    render: (item, context) => {
      const externalState = context.external as ExternalState;
      const [newState, setNewState] = externalState.newStateDetails;
      const canEdit = externalState.canEdit;
      if (item.type === 'NEW') {
        return (
          <Button
            isDisabled={!newState?.key || !canEdit}
            onClick={() => {
              if (newState) {
                externalState.onAdd({
                  key: newState.key,
                  createdAt: Date.now(),
                  type: newState.tagType,
                  options: newState.tagType === 'ENUM' ? newState.options : undefined,
                });
                setNewState(undefined);
              }
            }}
          >
            Add
          </Button>
        );
      }
    },
  }),
]);
function TagSettings() {
  const settings = useSettings();
  const permissions = useHasPermissions(['settings:users:write']);
  const mutateTenantSettings = useUpdateTenantSettings();
  const [newStateDetails, setNewStateDetails] = useState<Item | undefined>();
  const [isMaxTags, setIsMaxTags] = useState(false);
  const externalState: ExternalState = {
    canEdit: permissions,
    newStateDetails: [newStateDetails, setNewStateDetails],
    onAdd: (tag: ConsoleTag) => {
      if (settings.consoleTags?.length === 10) {
        setIsMaxTags(true);
        return;
      }
      mutateTenantSettings.mutate({
        consoleTags: [...(settings.consoleTags ?? []), tag],
      });
    },
  };
  const data: Item[] = [
    ...(settings.consoleTags?.map(
      (tag) =>
        ({
          rowKey: tag.key,
          key: tag.key,
          type: 'EXISTING',
          tagType: tag.type,
          options: tag.type === 'ENUM' ? tag.options : undefined,
        } as ExistingItem),
    ) ?? []),
    {
      rowKey: 'new',
      key: '',
      type: 'NEW',
      tagType: 'STRING',
    } as NewItem,
  ];

  return (
    <SettingsCard
      title="Tags"
      description="Define custom tag keys here, with values added on the user details page. Note that only a maximum of 10 keys can be added."
    >
      <Table
        toolsOptions={false}
        rowKey="rowKey"
        columns={columns}
        data={{
          items: data,
        }}
        externalState={externalState}
      ></Table>
      {isMaxTags && (
        <Alert type="error">
          A new key cannot be added as the limit of 10 tags has already been reached
        </Alert>
      )}
    </SettingsCard>
  );
}

export default TagSettings;
