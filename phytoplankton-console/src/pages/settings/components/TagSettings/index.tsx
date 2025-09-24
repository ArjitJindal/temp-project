import { useState } from 'react';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import SettingsCard from '@/components/library/SettingsCard';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import Alert from '@/components/library/Alert';
import { useHasResources } from '@/utils/user-utils';
import { ConsoleTag, ConsoleTagTypeEnum } from '@/apis';
import Select from '@/components/library/Select';
import RadioGroup from '@/components/ui/RadioGroup';
import { ColumnDataType } from '@/components/library/Table/types';
import { STRING } from '@/components/library/Table/standardDataTypes';

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

const TAG_TYPE: ColumnDataType<ConsoleTagTypeEnum, Item> = {
  render: (value) => <>{value}</>,
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <RadioGroup
        value={state}
        isDisabled={context.edit.isBusy}
        orientation="HORIZONTAL"
        onChange={(value) => {
          context.edit.onConfirm(value as ConsoleTagTypeEnum);
        }}
        options={[
          { value: 'STRING', label: 'String' },
          { value: 'ENUM', label: 'Enum' },
        ]}
      />
    );
  },
};

const TAG_OPTIONS: ColumnDataType<string[] | undefined, Item> = {
  render: (value, { item }) =>
    (item as Item).tagType === 'ENUM' ? <>{value?.join(', ')}</> : <>-</>,
  renderEdit: (context) => {
    const [state] = context.edit.state;
    const draft = context.item as Item;
    if ((draft as Item).tagType !== 'ENUM') {
      return <>-</>;
    }
    const options = (state ?? []).map((option) => ({ label: option, value: option }));
    return (
      <Select
        mode="MULTIPLE"
        allowNewOptions
        isDisabled={context.edit.isBusy}
        options={options}
        value={state}
        onChange={(newValue) => context.edit.onConfirm(newValue ?? [])}
      />
    );
  },
};

const helper = new ColumnHelper<Item>();
const columns = helper.list([
  helper.simple<'key'>({ title: 'Key', key: 'key', type: STRING as any, defaultWidth: 300 }),
  helper.simple<'tagType'>({
    title: 'Type',
    key: 'tagType',
    type: TAG_TYPE as any,
    defaultWidth: 300,
  }),
  helper.simple<'options'>({
    title: 'Options',
    key: 'options',
    type: TAG_OPTIONS as any,
    defaultWidth: 300,
  }),
  helper.display({
    title: 'Action',
    defaultWidth: 300,
    render: (item, context) => {
      const rowApi = context.rowApi;
      const draft = (rowApi?.getDraft?.() as Item) ?? item;
      const canEdit = true;
      if (rowApi?.isCreateRow) {
        return (
          <Button
            isDisabled={!draft?.key || !canEdit}
            isLoading={Boolean(rowApi?.isBusy)}
            onClick={() => rowApi?.save?.()}
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
  const permissions = useHasResources(['write:::settings/users/tags/*']);
  const mutateTenantSettings = useUpdateTenantSettings();
  const [isMaxTags, setIsMaxTags] = useState(false);
  const data: Item[] =
    settings.consoleTags?.map(
      (tag) =>
        ({
          rowKey: tag.key,
          key: tag.key,
          type: 'EXISTING',
          tagType: tag.type,
          options: tag.type === 'ENUM' ? tag.options : undefined,
        } as ExistingItem),
    ) ?? [];

  return (
    <SettingsCard
      title="Tags"
      description={`Define custom tag keys here, with values added on the ${settings.userAlias} details page. Note that only a maximum of 10 keys can be added.`}
      minRequiredResources={['read:::settings/users/tags/*']}
    >
      <Table
        toolsOptions={false}
        rowKey="rowKey"
        columns={columns}
        data={{
          items: data,
        }}
        createRow={{
          item: { rowKey: 'new', key: '', type: 'NEW', tagType: 'STRING' } as any,
          visible: permissions,
          onSubmit: (newTag) => {
            const tag = newTag as any as Item;
            if (!tag.key) {
              return;
            }
            if (settings.consoleTags?.length === 10) {
              setIsMaxTags(true);
              return;
            }
            mutateTenantSettings.mutate({
              consoleTags: [
                ...(settings.consoleTags ?? []),
                {
                  key: tag.key,
                  type: tag.tagType,
                  options: tag.tagType === 'ENUM' ? tag.options : undefined,
                  createdAt: Date.now(),
                } as ConsoleTag,
              ],
            });
          },
        }}
      ></Table>
      {isMaxTags && (
        <Alert type="ERROR">
          A new key cannot be added as the limit of 10 tags has already been reached
        </Alert>
      )}
    </SettingsCard>
  );
}

export default TagSettings;
