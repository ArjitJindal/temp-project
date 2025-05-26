import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { get } from 'lodash';
import {
  ACHDetails,
  Address,
  Amount,
  CardDetails,
  CardMerchantDetails,
  CashDetails,
  CheckDetails,
  ConsumerName,
  GenericBankAccountDetails,
  IBANDetails,
  MpesaDetails,
  POSDetails,
  SWIFTDetails,
  UPIDetails,
  WalletDetails,
} from '@/apis';
import {
  ExportDataStructureField,
  ExportDataStructureFieldGroup,
} from '@/components/library/Table/export';
import { ColumnDataType } from '@/components/library/Table/types';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';
import PaymentDetailsProps from '@/components/ui/PaymentDetailsProps';
import { PaymentDetails } from '@/utils/api/payment-details';

const typeNameToModel = {
  Address: Address,
  POSDetails: POSDetails,
  ConsumerName: ConsumerName,
  CardMerchantDetails: CardMerchantDetails,
  Amount: Amount,
};

// These fields are imported on top of all models instead of repeating for every payment method
const COMMON_FIELDS: ExportDataStructureField[] = [
  {
    id: 'method',
    label: 'Method',
    type: 'string',
  },
  {
    id: 'tags',
    label: 'Tags',
    type: 'string',
  },
];

function turnModelIntoField(name: string, model: any): ExportDataStructureFieldGroup {
  return {
    id: name,
    label: humanizeAuto(name),
    children: {
      fields: model.attributeTypeMap
        .filter((attr: { name: string }) => {
          return !COMMON_FIELDS.some((field) => field.id === attr.name);
        })
        .map((attr: any) => {
          if (attr.type === 'string' || attr.type === 'number' || attr.type === 'boolean') {
            return {
              id: attr.name,
              label: humanizeAuto(attr.name),
              type: attr.type,
            };
          }
          if (typeNameToModel[attr.type]) {
            return turnModelIntoField(attr.name, typeNameToModel[attr.type]);
          }
          return {
            id: attr.name,
            label: humanizeAuto(attr.name),
            type: attr.type,
          };
        }),
    },
  };
}

export const PAYMENT_DETAILS_OR_METHOD = (
  showDetailsView: boolean,
  exportTitle?: string,
): ColumnDataType<PaymentDetails> => ({
  stringify: (value) => {
    return `${value?.method}`;
  },
  defaultWrapMode: 'WRAP',
  render: (value) => {
    if (showDetailsView) {
      return <PaymentDetailsProps paymentDetails={value} />;
    }
    return <PaymentMethodTag paymentMethod={value?.method} />;
  },
  export: {
    dataStructure: {
      label: exportTitle,
      fields: [
        ...COMMON_FIELDS,
        turnModelIntoField('ACH', ACHDetails),
        turnModelIntoField('CARD', CardDetails),
        turnModelIntoField('IBAN', IBANDetails),
        turnModelIntoField('UPI', UPIDetails),
        turnModelIntoField('GENERIC_BANK_ACCOUNT', GenericBankAccountDetails),
        turnModelIntoField('MPESA', MpesaDetails),
        turnModelIntoField('SWIFT', SWIFTDetails),
        turnModelIntoField('WALLET', WalletDetails),
        turnModelIntoField('CHECK', CheckDetails),
        turnModelIntoField('CASH', CashDetails),
      ],
    },
    execute: (keys, value) => {
      const paymentMethod = value?.method;
      return keys.map((key) => {
        if (key.length === 0 || paymentMethod == null) {
          return { value: '' };
        }
        const isCommonField =
          key.length === 1 && COMMON_FIELDS.some((field) => field.id === key[0]);
        const fullKey = isCommonField ? [paymentMethod, ...key] : key;
        if (fullKey[0] !== paymentMethod) {
          return { value: '' };
        }
        const keyValue = get(value, fullKey.slice(1).join('.'));
        return {
          value: (typeof keyValue === 'object' ? JSON.stringify(keyValue) : keyValue) ?? '',
        };
      });
    },
  },
});
