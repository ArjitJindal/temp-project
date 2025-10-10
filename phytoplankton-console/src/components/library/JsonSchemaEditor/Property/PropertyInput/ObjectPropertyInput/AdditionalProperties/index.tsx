import React, { useState } from 'react';
import { ExtendedSchema } from '../../../../types';
import PropertyInput from '../../index';
import s from './style.module.less';
import Button from '@/components/library/Button';
import TextInput from '@/components/library/TextInput';
import DeleteBin7LineIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import { InputProps } from '@/components/library/Form';

// todo: fix any
interface Props extends InputProps<object> {
  schema: ExtendedSchema;
}

export default function AdditionalProperties(props: Props) {
  const { schema, value = {}, onChange } = props;

  const [newItem, setNewItem] = useState<{
    key: string;
    value: any;
  }>({
    key: '',
    value: undefined,
  });

  return (
    <div className={s.root}>
      <TextInput
        placeholder="New key"
        value={newItem.key}
        onChange={(newValue) => setNewItem((prevState) => ({ ...prevState, key: newValue ?? '' }))}
      />
      <PropertyInput
        value={newItem.value}
        onChange={(newValue) => {
          setNewItem((prevState) => ({
            ...prevState,
            value: newValue,
          }));
        }}
        schema={schema}
      />
      <Button
        type="PRIMARY"
        isDisabled={!newItem.key || !newItem.value}
        onClick={() => {
          onChange?.({
            ...value,
            [newItem.key]: newItem.value,
          });
          setNewItem({
            key: '',
            value: undefined,
          });
        }}
      >
        Add
      </Button>

      {Object.entries(value).map(([name, item], i) => (
        <React.Fragment key={name}>
          {i === 0 && (
            <>
              <div className={s.header}>Key</div>
              <div className={s.header}>Value</div>
              <div className={s.header}></div>
            </>
          )}
          <React.Fragment key={name}>
            <span>{name}</span>
            <PropertyInput
              value={item}
              onChange={(newValue) => {
                onChange?.({
                  ...value,
                  [name]: newValue,
                });
              }}
              schema={schema}
            />
            <Button
              icon={<DeleteBin7LineIcon />}
              type="TEXT"
              onClick={() => {
                const newValue = { ...value };
                delete newValue[name];
                onChange?.(newValue);
              }}
            >
              Delete
            </Button>
          </React.Fragment>
        </React.Fragment>
      ))}
    </div>
  );
}
