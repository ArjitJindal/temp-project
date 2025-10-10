import { useCallback, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import s from './index.module.less';
import { ChecklistTemplate } from '@/apis';
import { InputProps } from '@/components/library/Form';
import { ExtendedSchema } from '@/components/library/JsonSchemaEditor/types';
import Button from '@/components/library/Button';
import TextInput from '@/components/library/TextInput';
import Label from '@/components/library/Label';
import TextArea from '@/components/library/TextArea';
import * as Card from '@/components/ui/Card';
import CloseIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';
import CheckIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import AddIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import DeleteIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import { COLORS_V2_GRAY_6 } from '@/components/ui/colors';
import { message } from '@/components/library/Message';

export interface Props extends InputProps<ChecklistTemplate['categories']> {
  uiSchema?: ExtendedSchema;
}

export const CheckListCategoryListsInput = (props: Props) => {
  const { value, onChange } = props;

  const onCategoryNameChange = useCallback(
    (categoryIndex: number, name: string) => {
      onChange?.(
        value?.map((currentCategory, i) => {
          if (i === categoryIndex) {
            return { ...currentCategory, name: name ?? '' };
          }
          return currentCategory;
        }),
      );
    },
    [onChange, value],
  );

  const [checkListItemEditableIndex, setCheckListItemEditableIndex] = useState<{
    categoryIndex: number;
    checklistItemIndex: number;
  } | null>(null);
  const [name, setName] = useState<string>('');

  const handleEditChecklistItem = useCallback(
    (categoryIndex: number, checklistItemIndex: number) => {
      setCheckListItemEditableIndex({
        categoryIndex,
        checklistItemIndex,
      });
      setName(value?.[categoryIndex].checklistItems[checklistItemIndex].name ?? '');
    },
    [value, setName, setCheckListItemEditableIndex],
  );

  const onChecklistItemNameChange = useCallback(
    (name: string) => {
      setName(name);
    },
    [setName],
  );

  const addNewChecklistItem = useCallback(
    (categoryIndex: number, priority: 'P1' | 'P2') => {
      onChange?.(
        value?.map((currentCategory, i) => {
          if (i === categoryIndex) {
            return {
              ...currentCategory,
              checklistItems: [...currentCategory.checklistItems, { name: '', level: priority }],
            };
          }
          return currentCategory;
        }),
      );
      setCheckListItemEditableIndex({
        categoryIndex,
        checklistItemIndex: value?.[categoryIndex].checklistItems.length ?? 0,
      });
    },
    [onChange, value],
  );

  const removeChecklistItem = useCallback(
    (categoryIndex: number, checklistItemIndex: number) => {
      onChange?.(
        value?.map((currentCategory, i) => {
          if (i === categoryIndex) {
            return {
              ...currentCategory,
              checklistItems: currentCategory.checklistItems.filter(
                (_, j) => j !== checklistItemIndex,
              ),
            };
          }
          return currentCategory;
        }),
      );
      setCheckListItemEditableIndex(null);
      setName('');
    },
    [onChange, value],
  );

  const addCheclistItemToCategory = useCallback(
    (categoryIndex: number, checklistItemIndex: number, name: string, priority: 'P1' | 'P2') => {
      if (name === '') {
        message.error('Checklist item name cannot be empty');
        return;
      }
      onChange?.(
        value?.map((currentCategory, i) => {
          if (i === categoryIndex) {
            return {
              ...currentCategory,
              checklistItems: currentCategory.checklistItems.map((checklistItem, j) => {
                if (j === checklistItemIndex) {
                  return { ...checklistItem, name, level: priority };
                }
                return checklistItem;
              }),
            };
          }
          return currentCategory;
        }),
      );
      setCheckListItemEditableIndex(null);
      setName('');
    },
    [onChange, value],
  );

  return (
    <div className={s.root}>
      {value?.map((category, categoryIndex) => {
        return (
          <div key={categoryIndex + 'category'} className={s.root}>
            <Label
              label={'Category name'}
              required={{
                showHint: true,
                value: true,
              }}
            >
              <TextInput
                {...props}
                key={`${categoryIndex}-name`}
                value={category.name}
                placeholder="Enter checklist category name"
                onChange={(name) => onCategoryNameChange(categoryIndex, name ?? '')}
              />
            </Label>
            {(['P1', 'P2'] as const).map((priority, priorityIndex) => {
              return (
                <Label key={priorityIndex} label={`${priority} checklist items`}>
                  <Card.Root>
                    {category.checklistItems.map((checklistItem, checklistItemIndex) => {
                      return checklistItem.level === priority ? (
                        <Card.Section key={checklistItemIndex + 'section'}>
                          {checkListItemEditableIndex?.categoryIndex === categoryIndex &&
                          checkListItemEditableIndex?.checklistItemIndex === checklistItemIndex ? (
                            <div className={s.editableChecklistItem}>
                              <div
                                className={s.editableChecklistItemInput}
                                data-cy="checklist-item-text-area"
                              >
                                <TextArea
                                  {...props}
                                  value={name}
                                  onChange={(name) => onChecklistItemNameChange(name ?? '')}
                                />
                              </div>

                              <div className={s.editableChecklistItemButtons}>
                                <Button
                                  testName="check-button"
                                  type="TEXT"
                                  onClick={() => {
                                    addCheclistItemToCategory(
                                      categoryIndex,
                                      checklistItemIndex,
                                      name,
                                      priority,
                                    );
                                  }}
                                  icon={<CheckIcon />}
                                />
                                <Button
                                  type="TEXT"
                                  key={`${categoryIndex}-${checklistItemIndex}-remove`}
                                  icon={<CloseIcon />}
                                  onClick={() => {
                                    removeChecklistItem(categoryIndex, checklistItemIndex);
                                  }}
                                  style={{ color: COLORS_V2_GRAY_6 }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className={s.editableChecklistItem}>
                              <div className={s.editableChecklistItemInput}>
                                {checklistItem.name}
                              </div>
                              <div className={s.editableChecklistItemButtons}>
                                <Button
                                  type="TEXT"
                                  key={`${categoryIndex}-${checklistItemIndex}-edit`}
                                  icon={<EditOutlined />}
                                  onClick={() =>
                                    handleEditChecklistItem(categoryIndex, checklistItemIndex)
                                  }
                                  style={{ color: COLORS_V2_GRAY_6 }}
                                />
                                <Button
                                  type="TEXT"
                                  key={`${categoryIndex}-${checklistItemIndex}-remove`}
                                  icon={<CloseIcon />}
                                  onClick={() => {
                                    removeChecklistItem(categoryIndex, checklistItemIndex);
                                  }}
                                  style={{ color: COLORS_V2_GRAY_6 }}
                                />
                              </div>
                            </div>
                          )}
                        </Card.Section>
                      ) : (
                        <></>
                      );
                    })}
                    <div className={s.addNewChecklistItemButton}>
                      <Button
                        testName="add-new-checklist-item-button"
                        type="TEXT"
                        key={priorityIndex}
                        icon={<AddIcon />}
                        onClick={() => {
                          addNewChecklistItem(categoryIndex, priority);
                        }}
                        isDisabled={checkListItemEditableIndex != null}
                      >
                        Add new checklist item
                      </Button>
                    </div>
                  </Card.Root>
                </Label>
              );
            })}
            <div className={s.actionButtons}>
              <Button
                type="TETRIARY"
                className={s.button}
                onClick={() => onChange?.(value?.filter((_, i) => i !== categoryIndex))}
                icon={<DeleteIcon />}
              >
                Remove category
              </Button>
              {categoryIndex === value.length - 1 && (
                <Button
                  type="SECONDARY"
                  className={s.button}
                  onClick={() => onChange?.([...(value ?? []), { name: '', checklistItems: [] }])}
                >
                  Add new category
                </Button>
              )}
            </div>
            {categoryIndex !== value.length - 1 && <div className={s.divider} />}
          </div>
        );
      })}
      {!value?.length && (
        <Button
          testName="add-new-category-button"
          type="SECONDARY"
          className={s.button}
          onClick={() => onChange?.([...(value ?? []), { name: '', checklistItems: [] }])}
        >
          Add new category
        </Button>
      )}
    </div>
  );
};
