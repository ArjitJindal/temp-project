import React from 'react';
import s from './styles.module.less';
import { UserTag } from '@/apis';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import Button from '@/components/library/Button';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import { ColumnDataType } from '@/components/library/Table/types';

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
  const existingKeys = new Set((tags ?? []).map((t) => t.key));
  const consoleTags = settings.consoleTags ?? [];
  const getConsoleTagByKey = (key?: string) => consoleTags.find((t) => t.key === key);
  const keyOptions = consoleTags
    .filter((t) => !existingKeys.has(t.key))
    .map((t) => ({ label: t.key, value: t.key }));

  const KEY_TYPE: ColumnDataType<string, Item> = {
    render: (value) => <>{value}</>,
    renderEdit: (ctx) => {
      const rowApi = ctx.rowApi;
      if (!rowApi?.isCreateRow) {
        return <>{ctx.item.key}</>;
      }
      const draft = (rowApi.getDraft?.() as Item) ?? ctx.item;
      return (
        <Select
          mode="SINGLE"
          options={keyOptions}
          value={draft.key}
          onChange={(newKey) => {
            rowApi.setDraft?.((prevUnknown: unknown) => {
              const prev = (prevUnknown as Item) ?? ctx.item;
              return { ...prev, key: newKey ?? '', value: '' };
            });
          }}
        />
      );
    },
  };

  const VALUE_TYPE: ColumnDataType<string, Item> = {
    render: (value) => <>{value}</>,
    renderEdit: (ctx) => {
      const rowApi = ctx.rowApi;
      const draft = (rowApi?.getDraft?.() as Item) ?? ctx.item;
      const selectedKey = draft.key ?? ctx.item.key;
      const consoleTag = getConsoleTagByKey(selectedKey);
      const isEnum = consoleTag?.type === 'ENUM';
      if (isEnum) {
        const options = (consoleTag?.options ?? []).map((opt) => ({ label: opt, value: opt }));
        return (
          <Select
            mode="SINGLE"
            options={options}
            value={draft.value}
            onChange={(newVal) => {
              rowApi?.setDraft?.((prevUnknown: unknown) => {
                const prev = (prevUnknown as Item) ?? ctx.item;
                return { ...prev, value: newVal ?? '' };
              });
            }}
          />
        );
      }
      return (
        <TextInput
          className={s.valueInput}
          value={draft.value}
          onChange={(newVal) => {
            rowApi?.setDraft?.((prevUnknown: unknown) => {
              const prev = (prevUnknown as Item) ?? ctx.item;
              return { ...prev, value: newVal ?? '' };
            });
          }}
        />
      );
    },
  };

  const columns = helper.list([
    helper.simple<'key'>({
      title: 'Key',
      key: 'key',
      type: KEY_TYPE as any,
      defaultWidth: 300,
      tooltip: `Use tag keys defined in settings to add new tags for a ${settings.userAlias}.`,
    }),
    helper.simple<'value'>({
      title: 'Value',
      key: 'value',
      type: VALUE_TYPE as any,
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
