import { useMemo, useState } from 'react';
import { ExtendedSchema, UiSchemaPaymentFilters } from '../../../../types';
import Property from '../../..';
import { findRequiredProperty, useOrderedProps } from '../../../../utils';
import { InputProps } from '@/components/library/Form';
import { CountryCode, PaymentMethod } from '@/apis';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import { applyUpdater } from '@/utils/state';

type ValueType = {
  walletType?: string;
  cardPaymentChannels?: string[];
  cardIssuedCountries?: CountryCode[];
  paymentMethods?: PaymentMethod[];
};

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaPaymentFilters;
  schema: ExtendedSchema;
}

export const requiredPaymentMethodMap: Record<string, PaymentMethod> = {
  walletType: 'WALLET',
  cardIssuedCountries: 'CARD',
  cardPaymentChannels: 'CARD',
  mccCodes: 'CARD',
};

export default function PaymentFiltersInput(props: Props) {
  const { value, schema, onChange } = props;
  const properties = useOrderedProps(schema);
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});

  const { alwaysShowErrors, isDisabled } = useFormContext();

  const subContext: FormContextValue<ValueType | undefined> = useMemo(
    () => ({
      isDisabled,
      meta: fieldMeta,
      setMeta: (key, cb) => {
        setFieldsMeta((state) => {
          return {
            ...state,
            [key]: cb(state[key] ?? {}),
          };
        });
      },
      values: value ?? {},
      setValues: (updater) => {
        onChange?.(applyUpdater(value, updater));
      },
      alwaysShowErrors,
    }),
    [alwaysShowErrors, value, fieldMeta, onChange, isDisabled],
  );

  return (
    <FormContext.Provider value={subContext as FormContextValue<unknown>}>
      {properties
        .filter((property) => {
          if (property.name === 'paymentMethods') {
            return true;
          }
          if (value?.paymentMethods?.includes(requiredPaymentMethodMap[property.name])) {
            return true;
          }
          return false;
        })
        .map((property) => {
          return (
            <Property key={property.name} item={findRequiredProperty(properties, property.name)} />
          );
        })}
    </FormContext.Provider>
  );
}
