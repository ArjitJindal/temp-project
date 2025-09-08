import React from 'react';
import s from './styles.module.less';
import { UserTag } from '@/apis';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import TextInput from '@/components/library/TextInput';
import Button from '@/components/library/Button';
import Select from '@/components/library/Select';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

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
    helper.display({
      title: 'Key',
      tooltip: `Use tag keys defined in settings to add new tags for a ${settings.userAlias}.`,
      render: (item, context) => {
        const rowApi = context.rowApi;
        if (rowApi?.isCreateRow) {
          const draft = rowApi.getDraft() as UserTag;
          const availableKeys = (settings.consoleTags ?? [])
            .filter((tag) => !(tags ?? []).some((t) => t.key === tag.key))
            .map((tag) => ({ label: tag.key, value: tag.key }));
          return (
            <Select
              mode="SINGLE"
              value={draft.key}
              onChange={(e) => rowApi.setDraft({ ...draft, key: e ?? '' })}
              options={availableKeys}
            />
          );
        } else {
          return <>{item.key}</>;
        }
      },
      defaultWidth: 300,
    }),
    helper.display({
      title: 'Value',
      render: (item, context) => {
        const rowApi = context.rowApi;
        const tagDefs = settings.consoleTags ?? [];
        if (rowApi?.isCreateRow) {
          const draft = rowApi.getDraft() as UserTag;
          const tagDetails = tagDefs.find((t) => t.key === draft.key);
          return tagDetails?.type === 'ENUM' ? (
            <Select
              value={draft.value}
              mode="SINGLE"
              options={
                tagDetails?.options?.map((option) => ({ label: option, value: option })) ?? []
              }
              onChange={(e) => rowApi.setDraft({ ...draft, value: e ?? '' })}
            />
          ) : (
            <TextInput
              value={draft.value}
              onChange={(e) => rowApi.setDraft({ ...draft, value: e ?? '' })}
            />
          );
        } else {
          const rowApi = context.rowApi;
          const draft = (rowApi?.getDraft?.() as UserTag) ?? (item as UserTag);
          const isEditing = rowApi?.isEditing ?? false;
          const tagDetails = tagDefs.find((t) => t.key === draft?.key);
          return isEditing ? (
            tagDetails?.type === 'ENUM' ? (
              <Select
                value={draft.value}
                mode="SINGLE"
                options={
                  tagDetails?.options?.map((option) => ({ label: option, value: option })) ?? []
                }
                onChange={(e) => rowApi?.setDraft?.({ ...draft, value: e ?? '' })}
              />
            ) : (
              <TextInput
                value={draft.value}
                onChange={(e) => rowApi?.setDraft?.({ ...draft, value: e ?? '' })}
              />
            )
          ) : (
            <>{item.value}</>
          );
        }
      },
      defaultWidth: 400,
    }),
    helper.display({
      title: 'Actions',
      render: (item, context) => {
        const rowApi = context.rowApi;
        if (rowApi?.isCreateRow) {
          const draft = rowApi.getDraft() as UserTag;
          return (
            <Button
              isDisabled={!draft.key || !draft.value}
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
              <Button
                onClick={() => {
                  rowApi?.save?.();
                }}
              >
                Save
              </Button>
              <Button onClick={() => rowApi?.cancelEdit?.()}>Cancel</Button>
            </div>
          ) : (
            <div className={s.actions}>
              <Button isDisabled={!item.isEditable} onClick={() => rowApi?.startEdit?.()}>
                Edit
              </Button>
              <Button
                isDisabled={!item.isEditable}
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
    <Table
      rowKey="rowKey"
      data={{ items: data }}
      columns={columns}
      toolsOptions={false}
      createRow={{
        item: { key: '', value: '', isEditable: true, rowKey: 'new' } as any,
        position: 'BOTTOM',
        visible: true,
        onSubmit: (newTag) => {
          const draft = newTag as UserTag;
          if (!draft.key || !draft.value) {
            return;
          }
          setTags([...(tags ?? []), { key: draft.key, value: draft.value, isEditable: true }]);
        },
      }}
      rowEditing={{
        onSave: (_id, edited) => {
          const e = edited as UserTag;
          setTags((prev) =>
            (prev ?? []).map((t) => (t.key === e.key ? { ...t, value: e.value } : t)),
          );
        },
      }}
    />
  );
}

export default ApiTagsTable;
