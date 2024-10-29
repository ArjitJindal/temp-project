import React, { useState } from 'react';
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
interface CommonItem {
  rowKey: string;
  key: string;
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
  onAdd: (key: string) => void;
}

const helper = new ColumnHelper<Item>();
const columns = helper.list([
  helper.display({
    title: 'Key',
    defaultWidth: 300,
    render: (item, context) => {
      const externalState = context.external as ExternalState;
      const [newState, setNewState] = externalState.newStateDetails;
      if (item.type === 'NEW') {
        return (
          <TextInput
            value={newState?.key}
            onChange={(e) => setNewState({ key: e ?? '', type: 'NEW', rowKey: 'new' })}
          />
        );
      } else {
        return <>{item.key}</>;
      }
    },
  }),
  helper.display({
    title: 'Action',
    defaultWidth: 300,
    render: (item, context) => {
      const externalState = context.external as ExternalState;
      const [newState, setNewState] = externalState.newStateDetails;
      if (item.type === 'NEW') {
        return (
          <Button
            isDisabled={!newState?.key}
            onClick={() => {
              if (newState) {
                externalState.onAdd(newState.key);
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
  const mutateTenantSettings = useUpdateTenantSettings();
  const [newStateDetails, setNewStateDetails] = useState<Item | undefined>();
  const [isMaxTags, setIsMaxTags] = useState(false);
  const externalState: ExternalState = {
    newStateDetails: [newStateDetails, setNewStateDetails],
    onAdd: (key) => {
      if (settings.consoleTags?.length === 10) {
        setIsMaxTags(true);
        return;
      }
      mutateTenantSettings.mutate({
        consoleTags: [...(settings.consoleTags ?? []), { key, createdAt: Date.now() }],
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
        } as ExistingItem),
    ) ?? []),
    {
      rowKey: 'new',
      key: '',
      type: 'NEW',
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
