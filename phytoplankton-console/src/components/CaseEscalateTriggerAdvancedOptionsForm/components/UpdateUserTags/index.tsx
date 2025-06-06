import { useMemo, useState } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import Button from '@/components/library/Button';
import DeleteIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import { ModalWidth, isModalWidthGreatherThan } from '@/components/library/Modal';
import { useFormState } from '@/components/library/Form/utils/hooks';
import { UserTag } from '@/apis';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

type UserTagSelectionDeleteProps = {
  tagKey: string;
  value: string;
  isEditable: boolean;
  updateAction: (k: string, v: string) => void;
  deleteAction: (key: string) => void;
};

export const UpdateUserTags = (props: {
  size?: ModalWidth;
  extraClassName?: string;
  tags: UserTag[];
}) => {
  const { values, setValues } = useFormState<UserTag[]>();

  const removeTag = (key: string) => {
    setValues((prev) => {
      return prev?.filter((tag) => tag.key !== key) ?? [];
    });
  };

  const handleTagUpdate = (index: number, k: string, v: string) => {
    setValues((prev) => {
      return prev?.map((tag, idx) => {
        if (idx === index) {
          return { ...tag, [k]: v };
        }
        return tag;
      });
    });
  };

  const addTag = (key: string, value: string) => {
    setValues((prev) => {
      return [...(prev?.filter((tag) => tag.key !== key) ?? []), { key, value, isEditable: true }];
    });
  };

  return (
    <div className={cn(s.tagWrapper, isModalWidthGreatherThan(props.size ?? 'M', 'M') && s.scroll)}>
      <UserTagSelection action={addTag} values={values} />
      <div className={s.tagContainer}>
        {(values ?? []).map((tag, idx) => {
          if (!tag.isEditable) {
            return <></>;
          }
          return (
            <UserTagSelected
              tagKey={tag.key}
              value={tag.value}
              isEditable={tag.isEditable ?? false}
              deleteAction={removeTag}
              updateAction={(k: string, v: string) => handleTagUpdate(idx, k, v)}
              key={idx}
            />
          );
        })}
      </div>
    </div>
  );
};

const UserTagSelection = (props: {
  action: (key: string, value: string) => void;
  values: UserTag[];
}) => {
  const { action, values } = props;
  const initialState = { key: '', value: '' };
  const settings = useSettings();
  const [state, setState] = useState<{ key: string; value: string }>(initialState);
  const selectedTags: { [key: string]: boolean } = useMemo(() => {
    return values.reduce((acc, tag) => {
      acc[tag.key] = true;
      return acc;
    }, {});
  }, [values]);

  const resetState = () => {
    setState(initialState);
  };
  return (
    <div className={s.rowLayout}>
      <div className={cn(s.stateDetailsSingle, s.fullWidth)}>
        <InputField<UserTag, 'key'> name="key" label={'Select user tag to update'}>
          {(inputProps) => (
            <Select<string>
              {...inputProps}
              options={(settings?.consoleTags ?? [])
                .filter((tag) => !selectedTags[tag.key])
                .map((tag) => ({
                  label: tag.key,
                  value: tag.key,
                }))}
              onChange={(value) => {
                if (value) {
                  setState((prev) => ({ ...prev, key: value }));
                }
              }}
              value={state.key}
            />
          )}
        </InputField>
      </div>

      <div className={cn(s.stateDetailsSingle, s.fullWidth)}>
        <InputField<UserTag, 'value'> name="value" label="Update user tag value to">
          {(inputProps) => (
            <TextInput
              {...inputProps}
              onChange={(value) => {
                if (value) {
                  setState((prev) => ({ ...prev, value }));
                }
              }}
              value={state.value}
              inputClassName={s.textInput}
              className={s.inputContainer}
            />
          )}
        </InputField>
      </div>

      <div className={s.stateDetailsSingle}>
        <InputField<{ addButton: string }, 'addButton'> name="addButton" label="">
          {() => (
            <Button
              type="PRIMARY"
              onClick={() => {
                if (state.key && state.value) {
                  action(state.key, state.value);
                  resetState();
                }
              }}
              requiredResources={['write:::users/user-tags/*']}
            >
              Add
            </Button>
          )}
        </InputField>
      </div>
    </div>
  );
};

const UserTagSelected = (props: UserTagSelectionDeleteProps) => {
  const { tagKey, value, deleteAction, isEditable, updateAction } = props;

  return (
    <div className={s.rowLayout}>
      <div className={cn(s.stateDetailsSingle, s.fullWidth)}>
        <InputField<UserTag, 'key'> name="key" label={'User tag'}>
          {() => (
            <TextInput
              value={tagKey}
              inputClassName={s.textInput}
              className={s.inputContainer}
              onChange={(value) => {
                if (isEditable) {
                  updateAction('key', value ?? '');
                }
              }}
            />
          )}
        </InputField>
      </div>

      <div className={cn(s.stateDetailsSingle, s.fullWidth)}>
        <InputField<UserTag, 'value'> name="value" label="User tag updated value">
          {() => (
            <TextInput
              value={value}
              inputClassName={s.textInput}
              className={s.inputContainer}
              onChange={(value) => {
                if (isEditable) {
                  updateAction('value', value ?? '');
                }
              }}
            />
          )}
        </InputField>
      </div>

      <div className={s.stateDetailsSingle}>
        <InputField<{ deleteButton: string }, 'deleteButton'> name="deleteButton" label="">
          {() => (
            <div className={cn(s.iconButton, !isEditable && s.iconButtonDisabled)}>
              <DeleteIcon
                onClick={() => {
                  if (isEditable) {
                    deleteAction(tagKey);
                  }
                }}
                height={'1rem'}
                width={'1rem'}
              />
            </div>
          )}
        </InputField>
      </div>
    </div>
  );
};
