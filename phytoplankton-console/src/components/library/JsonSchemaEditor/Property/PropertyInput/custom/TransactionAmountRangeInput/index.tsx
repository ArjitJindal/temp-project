import React, { useState } from 'react';
import { CURRENCIES_SELECT_OPTIONS, Currency } from '@flagright/lib/constants';
import s from './style.module.less';
import NumberInput from '@/components/library/NumberInput';
import { InputProps } from '@/components/library/Form';
import Select from '@/components/library/Select';
import Button from '@/components/library/Button';
import Money from '@/components/ui/Money';
import DeleteBin7LineIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import { UiSchemaTransactionAmountRange } from '@/components/library/JsonSchemaEditor/types';
import { message } from '@/components/library/Message';

type ValueType = Record<Currency, { min?: number; max?: number }>;

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaTransactionAmountRange;
}

export default function TransactionAmountRangeInput(props: Props) {
  const { value, onChange, ...rest } = props;

  const [newItem, setNewItem] = useState<
    Partial<{ currency: Currency; min?: number; max: number }>
  >({});
  const isAddDisabled = newItem?.currency == null || (newItem?.min == null && newItem?.min == null);
  const handleAdd = () => {
    if (newItem.min == null && newItem.max == null) {
      return;
    }
    if (newItem.min != null && newItem.max != null && newItem.min > newItem.max) {
      message.warn('Min. amount should be less than max. amount');
      return;
    }
    if (!isAddDisabled && newItem.currency) {
      onChange?.({
        ...(value ?? ({} as ValueType)),
        [newItem.currency]: {
          min: newItem.min,
          max: newItem.max,
        },
      });
      setNewItem({});
    }
  };

  return (
    <div className={s.root}>
      <Select<Currency>
        placeholder="Select currency"
        mode={'SINGLE'}
        value={newItem?.currency}
        onChange={(currency) => setNewItem((prevState) => ({ ...prevState, currency }))}
        options={CURRENCIES_SELECT_OPTIONS.map((option) => ({
          ...option,
          isDisabled: value?.[option.value] != null,
        }))}
        {...rest}
      />
      <NumberInput
        placeholder="Min. amount"
        value={newItem?.min}
        onChange={(min) =>
          setNewItem((prevState) => ({
            ...prevState,
            min,
          }))
        }
        min={0}
        {...rest}
      />
      <NumberInput
        placeholder="Max. amount"
        value={newItem?.max}
        onChange={(max) =>
          setNewItem((prevState) => ({
            ...prevState,
            max,
          }))
        }
        min={0}
        {...rest}
      />
      <Button type="PRIMARY" onClick={handleAdd} isDisabled={isAddDisabled}>
        Add
      </Button>
      {value && Object.keys(value).length > 0 && (
        <>
          <div className={s.header}>Currency</div>
          <div className={s.header}>Min. amount</div>
          <div className={s.header}>Max. amount</div>
          <div className={s.header}></div>
        </>
      )}
      {value &&
        Object.entries(value ?? {}).map((entry, i) => {
          const currency = entry[0] as Currency;
          const { min, max } = entry[1] ?? {};
          return (
            <React.Fragment key={i}>
              <div>{currency}</div>
              <Money currency={currency} value={min} />
              <Money currency={currency} value={max} />
              <Button
                icon={<DeleteBin7LineIcon />}
                type="TEXT"
                onClick={() => {
                  const newValue: ValueType = { ...(value ?? {}) };
                  delete newValue[currency];
                  onChange?.(newValue);
                }}
              >
                Delete
              </Button>
            </React.Fragment>
          );
        })}
    </div>
  );
}
