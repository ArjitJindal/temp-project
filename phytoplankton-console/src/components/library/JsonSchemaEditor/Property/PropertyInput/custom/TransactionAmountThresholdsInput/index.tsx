import React, { useState } from 'react';
import { Currency } from '@flagright/lib/constants';
import s from './style.module.less';
import NumberInput from '@/components/library/NumberInput';
import { InputProps } from '@/components/library/Form';
import Button from '@/components/library/Button';
import Money from '@/components/ui/Money';
import DeleteBin7LineIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import { UiSchemaTransactionAmountThresholds } from '@/components/library/JsonSchemaEditor/types';
import CurrencyInput from '@/components/library/JsonSchemaEditor/Property/PropertyInput/custom/CurrencyInput';

type ValueType = Record<Currency, number>;

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaTransactionAmountThresholds;
}

export default function TransactionAmountThresholdsInput(props: Props) {
  const { value, onChange, uiSchema: _uiSchema, ...rest } = props;

  const [newItem, setNewItem] = useState<Partial<{ currency: Currency; amount?: number }>>({});
  const isAddDisabled = newItem?.currency == null || newItem?.amount == null;
  const handleAdd = () => {
    if (!isAddDisabled && newItem.currency && newItem.amount) {
      onChange?.({
        ...(value ?? ({} as ValueType)),
        [newItem.currency]: newItem.amount,
      });
      setNewItem({});
    }
  };

  return (
    <div className={s.root}>
      <CurrencyInput
        value={newItem?.currency}
        onChange={(currency) => setNewItem((prevState) => ({ ...prevState, currency }))}
        {...rest}
      />
      <NumberInput
        placeholder="Amount"
        value={newItem?.amount}
        onChange={(amount) =>
          setNewItem((prevState) => ({
            ...prevState,
            amount,
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
          <div className={s.header}>Amount</div>
          <div className={s.header}></div>
        </>
      )}
      {value &&
        Object.entries(value ?? {}).map((entry, i) => {
          const currency = entry[0] as Currency;
          const amount = entry[1];
          return (
            <React.Fragment key={i}>
              <div>{currency}</div>
              <Money currency={currency} value={amount} />
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
