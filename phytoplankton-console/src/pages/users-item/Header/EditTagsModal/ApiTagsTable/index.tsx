import React from 'react';
import s from './styles.module.less';
import { UserTag } from '@/apis';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import Button from '@/components/library/Button';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { STRING } from '@/components/library/Table/standardDataTypes';

interface Props {
  tags: UserTag[] | undefined;
  setTags: React.Dispatch<React.SetStateAction<UserTag[] | undefined>>;
}

interface ApiTagTableItem {
  key: string;
  value: string;
  isEditable?: boolean;
  rowKey: string;
}

interface ExistingItem extends ApiTagTableItem {
  type: 'EXISTING';
}

interface NewItem extends ApiTagTableItem {
  type: 'NEW';
}

type Item = ExistingItem | NewItem;

function ApiTagsTable(props: Props) {
  const settings = useSettings();
  const { tags, setTags } = props;

  const helper = new ColumnHelper<Item>();
  const columns = helper.list([
    helper.simple<'key'>({
      title: 'Key',
      key: 'key',
      type: STRING,
      defaultWidth: 300,
      tooltip: `Use tag keys defined in settings to add new tags for a ${settings.userAlias}.`,
    }),
    helper.simple<'value'>({
      title: 'Value',
      key: 'value',
      type: STRING,
      defaultWidth: 400,
    }),
    helper.display({
      title: 'Actions',
      render: (item, context) => {
        const rowApi = context.rowApi;
        if (rowApi?.isCreateRow) {
          const draft = rowApi.getDraft() as Item;
          return (
            <Button
              isDisabled={!draft.key || !draft.value}
              isLoading={Boolean(rowApi?.isBusy)}
              onClick={() => {
                rowApi.save?.();
              }}
            >
              Add
            </Button>
          );
        } else {
          const isEditing = rowApi?.isEditing ?? false;
          return isEditing ? (
            <div className={s.actions}>
              <Button isLoading={Boolean(rowApi?.isBusy)} onClick={() => rowApi?.save?.()}>
                Save
              </Button>
              <Button isLoading={Boolean(rowApi?.isBusy)} onClick={() => rowApi?.cancelEdit?.()}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className={s.actions}>
              <Button
                isDisabled={!item.isEditable}
                isLoading={Boolean(rowApi?.isBusy)}
                onClick={() => rowApi?.startEdit?.()}
              >
                Edit
              </Button>
              <Button
                isDisabled={!item.isEditable}
                isLoading={Boolean(rowApi?.isBusy)}
                onClick={() => {
                  setTags((tags ?? []).filter((tag) => tag.key !== item.key));
                }}
              >
                Delete
              </Button>
            </div>
          );
        }
      },
    }),
  ]);
  const data: Item[] =
    tags?.map((tag) => ({
      key: tag.key,
      value: tag.value,
      rowKey: tag.key,
      isEditable: tag.isEditable,
      type: 'EXISTING',
    })) ?? [];
  return (
    <Table<Item>
      rowKey="rowKey"
      data={{ items: data }}
      columns={columns}
      toolsOptions={false}
      createRow={{
        item: { key: '', value: '', isEditable: true, rowKey: 'new', type: 'NEW' },
        position: 'BOTTOM',
        visible: true,
        onSubmit: (draft: Item) => {
          if (!draft.key || !draft.value) {
            return;
          }
          setTags([...(tags ?? []), { key: draft.key, value: draft.value, isEditable: true }]);
        },
      }}
      rowEditing={{
        onSave: (_id, edited: Item) => {
          setTags((prev) =>
            (prev ?? []).map((t) => (t.key === edited.key ? { ...t, value: edited.value } : t)),
          );
        },
      }}
    />
  );
}

export default ApiTagsTable;
