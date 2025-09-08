import { useState } from 'react';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import SettingsCard from '@/components/library/SettingsCard';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import TextInput from '@/components/library/TextInput';
import Alert from '@/components/library/Alert';
import { useHasResources } from '@/utils/user-utils';
import { ConsoleTag, ConsoleTagTypeEnum } from '@/apis';
import Select from '@/components/library/Select';
import RadioGroup from '@/components/ui/RadioGroup';

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

const helper = new ColumnHelper<Item>();
const columns = helper.list([
  helper.display({
    title: 'Key',
    defaultWidth: 300,
    render: (item, context) => {
      const rowApi = context.rowApi;
      const draft = (rowApi?.getDraft?.() as Item) ?? item;
      const canEdit = true;
      if (rowApi?.isCreateRow) {
        return (
          <TextInput
            value={draft.key}
            onChange={(e) => rowApi.setDraft({ ...draft, key: e ?? '' } as Item)}
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
      const rowApi = context.rowApi;
      const draft = (rowApi?.getDraft?.() as Item) ?? item;

      return (
        <RadioGroup
          value={draft.tagType}
          isDisabled={!rowApi?.isCreateRow}
          orientation="HORIZONTAL"
          onChange={(value) => {
            rowApi?.setDraft?.({ ...draft, tagType: value as ConsoleTagTypeEnum } as Item);
          }}
          options={[
            { value: 'STRING', label: 'String' },
            { value: 'ENUM', label: 'Enum' },
          ]}
        />
      );
    },
  }),
  helper.display({
    title: 'Options',
    defaultWidth: 300,
    render: (item, context) => {
      const rowApi = context.rowApi;
      const draft = (rowApi?.getDraft?.() as Item) ?? item;
      const canEdit = true;
      if (rowApi?.isCreateRow && draft.tagType === 'ENUM') {
        return (
          <Select
            mode="MULTIPLE"
            allowNewOptions
            isDisabled={!rowApi?.isCreateRow || !canEdit}
            options={
              item.options?.map((option) => ({
                label: option,
                value: option,
              })) ?? []
            }
            value={draft.options}
            onChange={(e) => rowApi?.setDraft?.({ ...draft, options: e ?? [] } as Item)}
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
      const rowApi = context.rowApi;
      const draft = (rowApi?.getDraft?.() as Item) ?? item;
      const canEdit = true;
      if (rowApi?.isCreateRow) {
        return (
          <Button isDisabled={!draft?.key || !canEdit} onClick={() => rowApi?.save?.()}>
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
