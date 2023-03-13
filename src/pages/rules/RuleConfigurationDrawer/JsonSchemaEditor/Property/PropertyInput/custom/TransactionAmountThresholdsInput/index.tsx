import React, { useState } from 'react';
import s from './style.module.less';
import NumberInput from '@/components/library/NumberInput';
import { InputProps } from '@/components/library/Form';
import { Currency } from '@/utils/currencies';
import Button from '@/components/library/Button';
import Money from '@/components/ui/Money';
import DeleteBin7LineIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import { ExtendedSchema } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/types';
import CurrencyInput from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/Property/PropertyInput/custom/CurrencyInput';

type ValueType = Record<Currency, number>;

interface Props extends InputProps<ValueType> {
  schema: ExtendedSchema;
}

export default function TransactionAmountThresholdsInput(props: Props) {
  const { value, onChange, ...rest } = props;

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
