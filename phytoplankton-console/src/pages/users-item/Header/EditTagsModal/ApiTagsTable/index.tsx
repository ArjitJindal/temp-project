import React, { useState } from 'react';
import s from './styles.module.less';
import { UserTag, ConsoleTag } from '@/apis';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import TextInput from '@/components/library/TextInput';
import { StatePair } from '@/utils/state';
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

interface ExternalState {
  editStateDetails: StatePair<UserTag | undefined>;
  newStateDetails: StatePair<UserTag>;
  tagsDetails: StatePair<UserTag[] | undefined>;
  consoleTags: ConsoleTag[] | undefined;
}

type Item = ExistingItem | NewItem;

function ApiTagsTable(props: Props) {
  const settings = useSettings();
  const { tags, setTags } = props;
  const [editStateDetails, setEditStateDetails] = useState<UserTag | undefined>(undefined);
  const [newStateDetails, setNewStateDetails] = useState<UserTag>({
    key: '',
    value: '',
    isEditable: true,
  });

  const helper = new ColumnHelper<Item>();
  const columns = helper.list([
    helper.display({
      title: 'Key',
      tooltip: `Use tag keys defined in settings to add new tags for a ${settings.userAlias}.`,
      render: (item, context) => {
        const { newStateDetails, consoleTags, tagsDetails } = context.external as ExternalState;
        const [newState, setNewState] = newStateDetails;
        const [tags] = tagsDetails;
        if (item.type === 'NEW') {
          return (
            <Select
              mode="SINGLE"
              value={newState.key}
              onChange={(e) => setNewState({ ...newState, key: e ?? '' })}
              options={
                consoleTags
                  ?.filter((tag) => !tags?.some((t) => t.key === tag.key))
                  ?.map((tag) => ({ label: tag.key, value: tag.key })) ?? []
              }
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
        const { editStateDetails, newStateDetails, consoleTags } =
          context.external as ExternalState;
        const [editState, setEditState] = editStateDetails;
        const [newState, setNewState] = newStateDetails;
        if (item.type === 'NEW') {
          const tagDetails = consoleTags?.find((tag) => tag.key === newState.key);
          return tagDetails?.type === 'ENUM' ? (
            <Select
              value={newState.value}
              mode="SINGLE"
              options={
                tagDetails?.options?.map((option) => ({ label: option, value: option })) ?? []
              }
              onChange={(e) => setNewState({ ...newState, value: e ?? '' })}
            />
          ) : (
            <TextInput
              value={newState.value}
              onChange={(e) => setNewState({ ...newState, value: e ?? '' })}
            />
          );
        } else {
          const tagDetails = consoleTags?.find((tag) => tag.key === editState?.key);
          return editState?.key === item.key ? (
            tagDetails?.type === 'ENUM' ? (
              <Select
                value={editState.value}
                mode="SINGLE"
                options={
                  tagDetails?.options?.map((option) => ({ label: option, value: option })) ?? []
                }
                onChange={(e) =>
                  setEditState({
                    key: editState.key,
                    value: e ?? '',
                    isEditable: true,
                  })
                }
              />
            ) : (
              <TextInput
                value={editState.value}
                onChange={(e) =>
                  setEditState({
                    key: editState.key,
                    value: e ?? '',
                    isEditable: true,
                  })
                }
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
        const { editStateDetails, newStateDetails, tagsDetails } =
          context.external as ExternalState;
        const [editState, setEditState] = editStateDetails;
        const [newState, setNewState] = newStateDetails;
        const [tags, setTags] = tagsDetails;
        if (item.type === 'NEW') {
          return (
            <Button
              isDisabled={!newState.key || !newState.value}
              onClick={() => {
                if (newState.key && newState.value) {
                  setTags([...(tags ?? []), { ...newState, isEditable: true }]);
                  setNewState({ key: '', value: '', isEditable: true });
                }
              }}
            >
              Add
            </Button>
          );
        } else if (item.type === 'EXISTING') {
          return editState?.key === item.key ? (
            <div className={s.actions}>
              <Button
                onClick={() => {
                  setTags(
                    tags?.map((tag) =>
                      tag.key === item.key
                        ? { key: item.key, value: editState.value, isEditable: true }
                        : tag,
                    ),
                  );
                  setEditState(undefined);
                }}
              >
                Save
              </Button>
              <Button
                onClick={() => {
                  setEditState(undefined);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className={s.actions}>
              <Button
                isDisabled={!item.isEditable}
                onClick={() => {
                  setEditState({
                    key: item.key,
                    value: item.value,
                    isEditable: true,
                  });
                }}
              >
                Edit
              </Button>
              <Button
                isDisabled={!item.isEditable}
                onClick={() => {
                  setTags(tags?.filter((tag) => tag.key !== item.key));
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

  const externalState: ExternalState = {
    editStateDetails: [editStateDetails, setEditStateDetails],
    newStateDetails: [newStateDetails, setNewStateDetails],
    tagsDetails: [tags, setTags],
    consoleTags: settings.consoleTags,
  };
  const data: Item[] = [
    ...(tags?.map(
      (tag) =>
        ({
          key: tag.key,
          value: tag.value,
          type: 'EXISTING',
          rowKey: tag.key,
          isEditable: tag.isEditable,
        } as ExistingItem),
    ) ?? []),
    {
      key: '',
      rowKey: '_NEW_TAG_',
      value: '',
      type: 'NEW',
      isEditable: true,
    },
  ];
  return (
    <Table
      rowKey="rowKey"
      data={{ items: data }}
      columns={columns}
      toolsOptions={false}
      externalState={externalState}
    />
  );
}

export default ApiTagsTable;
