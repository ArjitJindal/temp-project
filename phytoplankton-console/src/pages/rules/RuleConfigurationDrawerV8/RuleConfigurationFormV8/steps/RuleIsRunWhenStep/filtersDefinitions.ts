import { COUNTRIES, COUNTRY_ALIASES } from '@flagright/lib/constants';
import { ValueType as AgeRangeInputValueType } from 'src/components/library/AgeRangeInput';
import {
  Filter,
  FilterBuildLogicContext,
} from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/steps/RuleIsRunWhenStep/FiltersCard/types';
import { RuleLogic } from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/types';
import { PAYMENT_METHODS, getPaymentMethodTitle } from '@/utils/payments';

type UserType = 'CONSUMER' | 'BUSINESS';
type Direction = 'SENDER' | 'RECEIVER';

export type FiltersValues = {
  direction?: 'ALL' | Direction;
  userType?: 'ALL' | UserType;
  [key: string]: unknown | undefined;
};

function iterateTypeAndDirection<Values extends FiltersValues>(
  cb: (userType: UserType, direction: Direction) => RuleLogic | undefined,
  context: FilterBuildLogicContext<Values>,
): RuleLogic | undefined {
  const { deps } = context;
  const { direction = 'ALL', userType = 'ALL' } = deps;
  const directions: Direction[] = direction === 'ALL' ? ['SENDER', 'RECEIVER'] : [direction];
  const userTypes: UserType[] = userType === 'ALL' ? ['CONSUMER', 'BUSINESS'] : [userType];
  const result: RuleLogic[] = [];
  for (const nextDirection of directions) {
    for (const nextUserType of userTypes) {
      const logicItem = cb(nextUserType, nextDirection);
      if (logicItem != null) {
        result.push(logicItem);
      }
    }
  }
  if (result.length === 0) {
    return undefined;
  }
  return {
    or: result,
  };
}

export const USER_FILTERS: Filter<FiltersValues>[] = [
  {
    name: 'direction',
    title: 'User direction',
    description: 'Choose the user’s direction you want for the rule to run.',
    valueType: {
      kind: 'SELECTION_GROUP',
      defaultValue: 'ALL',
      options: [
        { value: 'ALL', label: 'All' },
        { value: 'SENDER', label: 'Origin' },
        { value: 'RECEIVER', label: 'Destination' },
      ],
    },
  },
  {
    name: 'userType',
    title: 'User type',
    description: 'Choose type of users you want for the rule to run.',
    valueType: {
      kind: 'SELECTION_GROUP',
      defaultValue: 'ALL',
      options: [
        { value: 'ALL', label: 'All' },
        { value: 'CONSUMER', label: 'Consumer' },
        { value: 'BUSINESS', label: 'Business' },
      ],
    },
    buildLogic: (value) => ({ '==': [{ var: 'USER:type' }, value] }),
  },
  {
    name: 'userAge',
    title: 'User age',
    description: "If the user's age falls within the set range, execute the rule.",
    valueType: {
      kind: 'AGE_RANGE',
    },
    buildLogic: (value: unknown | undefined, context) => {
      const ageValue = value as AgeRangeInputValueType | undefined;
      let ageField;
      if (ageValue == null || ageValue.minAge?.granularity === 'year') {
        ageField = 'ageYears';
      } else if (ageValue.minAge?.granularity === 'month') {
        ageField = 'ageMonths';
      } else if (ageValue.minAge?.granularity === 'day') {
        ageField = 'ageDays';
      }
      return iterateTypeAndDirection(
        (nextUserType, nextDirection) => ({
          '<=': [
            ageValue?.minAge?.units ?? Number.MIN_SAFE_INTEGER,
            { var: `${nextUserType}_USER:${ageField}__${nextDirection}` },
            ageValue?.maxAge?.units ?? Number.MAX_SAFE_INTEGER,
          ],
        }),
        context,
      );
    },
  },
  {
    name: 'userCreationAge',
    title: 'User age at the time of creation',
    description:
      'If the user’s age at the time of creation is within the set range, execute the rule.',
    valueType: {
      kind: 'AGE_RANGE',
    },
    buildLogic: (value: unknown, context) => {
      const ageValue = value as AgeRangeInputValueType | undefined;
      let ageField;
      if (ageValue == null || ageValue.minAge?.granularity === 'year') {
        ageField = 'creationAgeYears';
      } else if (ageValue.minAge?.granularity === 'month') {
        ageField = 'creationAgeMonths';
      } else if (ageValue.minAge?.granularity === 'day') {
        ageField = 'creationAgeDays';
      }
      return iterateTypeAndDirection(
        (nextUserType, nextDirection) => ({
          '<=': [
            ageValue?.minAge?.units ?? Number.MIN_SAFE_INTEGER,
            { var: `${nextUserType}_USER:${ageField}__${nextDirection}` },
            ageValue?.maxAge?.units ?? Number.MAX_SAFE_INTEGER,
          ],
        }),
        context,
      );
    },
  },
  {
    name: 'countryOfResidence',
    title: 'Country of residence',
    description: 'If the user’s country of residence is within the selection, execute the rule.',
    valueType: {
      kind: 'SELECT',
      mode: 'MULTIPLE',
      options: Object.entries(COUNTRIES).map(([countryCode, name]) => ({
        value: countryCode,
        label: name,
        alternativeLabels: COUNTRY_ALIASES[countryCode] ?? [],
      })),
      placeholder: 'Select countries of residence',
    },
    buildLogic: (value: unknown | undefined, context) => {
      const valueArr = value as string[];
      return iterateTypeAndDirection((userType, direction): RuleLogic => {
        return {
          in: [
            {
              var:
                userType === 'CONSUMER'
                  ? `CONSUMER_USER:userDetails-countryOfResidence__${direction}`
                  : `BUSINESS_USER:legalEntity-companyRegistrationDetails-registrationCountry__${direction}`,
            },
            valueArr,
          ],
        };
      }, context);
    },
  },
  {
    name: 'countryOfNationality',
    title: 'Country of nationality',
    description: 'If the user’s country of nationality is within the selection, execute the rule.',
    valueType: {
      kind: 'SELECT',
      mode: 'MULTIPLE',
      options: Object.entries(COUNTRIES).map(([countryCode, name]) => ({
        value: countryCode,
        label: name,
        alternativeLabels: COUNTRY_ALIASES[countryCode] ?? [],
      })),
      placeholder: 'Select countries of nationality',
    },
    buildLogic: (value: unknown | undefined, context) => {
      const valueArr = value as string[];
      return iterateTypeAndDirection((userType, direction) => {
        if (userType === 'BUSINESS') {
          // todo: implement when there are vars for shareholders
          return;
        }
        return {
          in: [
            {
              var:
                userType === 'CONSUMER'
                  ? `CONSUMER_USER:userDetails-countryOfNationality__${direction}`
                  : `BUSINESS_USER:legalEntity-companyRegistrationDetails-registrationCountry__${direction}`,
            },
            valueArr,
          ],
        };
      }, context);
    },
  },
];

export const TRANSACTIONS_FILTERS: Filter<FiltersValues>[] = [
  {
    name: 'senderPaymentMethod',
    title: 'Sender payment method',
    description: 'Select sender payment method(s) to filter transactions.',
    valueType: {
      kind: 'SELECT',
      mode: 'MULTIPLE',
      options: PAYMENT_METHODS.map((type) => ({
        value: type,
        label: getPaymentMethodTitle(type),
      })),
      placeholder: 'Select payment methods',
    },
    buildLogic: (value: unknown | undefined): RuleLogic => {
      const valueArr = value as string[];
      return {
        in: [
          {
            var: 'TRANSACTION:originPaymentDetails-method',
          },
          valueArr,
        ],
      };
    },
  },
  // todo: enable when we have a list of wallet types
  // {
  //   name: 'senderWalletType',
  //   title: 'Sender wallet type',
  //   description: 'Select sender wallet type(s) to filter transactions.',
  //   valueType: {
  //     kind: 'SELECT',
  //     mode: 'MULTIPLE',
  //     options: [],
  //   },
  //   buildLogic: (value: unknown) => {
  //     const valueArr = value as string[];
  //     return {
  //       in: [{ var: 'TRANSACTION:originPaymentDetails-walletType' }, valueArr],
  //     };
  //   },
  // },
  {
    name: 'senderTransactionCountries',
    title: 'Sender transaction countries',
    description: 'Select sender transaction countries to filter transactions.',
    valueType: {
      kind: 'SELECT',
      mode: 'MULTIPLE',
      options: Object.entries(COUNTRIES).map(([countryCode, name]) => ({
        value: countryCode,
        label: name,
        alternativeLabels: COUNTRY_ALIASES[countryCode] ?? [],
      })),
      placeholder: 'Select countries',
    },
    buildLogic: (value: unknown | undefined) => {
      const valueArr = value as string[];
      return {
        in: [
          {
            var: `TRANSACTION:originPaymentDetails-country`,
          },
          valueArr,
        ],
      };
    },
  },
  {
    name: 'receiverPaymentMethod',
    title: 'Receiver payment method',
    description: 'Select receiver payment method(s) to filter transactions.',
    valueType: {
      kind: 'SELECT',
      mode: 'MULTIPLE',
      options: PAYMENT_METHODS.map((type) => ({
        value: type,
        label: getPaymentMethodTitle(type),
      })),
      placeholder: 'Select payment methods',
    },
    buildLogic: (value: unknown | undefined): RuleLogic => {
      const valueArr = value as string[];
      return {
        in: [
          {
            var: 'TRANSACTION:destinationPaymentDetails-method',
          },
          valueArr,
        ],
      };
    },
  },
  // todo: enable when we have a list of wallet types
  // {
  //   name: 'receiverWalletType',
  //   title: 'Receiver wallet type',
  //   description: 'Select receiver wallet type(s) to filter transactions.',
  //   valueType: {
  //     kind: 'SELECT',
  //     mode: 'MULTIPLE',
  //     options: [],
  //   },
  //   buildLogic: (value: unknown) => {
  //     const valueArr = value as string[];
  //     return {
  //       in: [{ var: 'TRANSACTION:destinationPaymentDetails-walletType' }, valueArr],
  //     };
  //   },
  // },
  {
    name: 'receiverTransactionCountries',
    title: 'Receiver transaction countries',
    description: 'Select receiver transaction countries to filter transactions.',
    valueType: {
      kind: 'SELECT',
      mode: 'MULTIPLE',
      options: Object.entries(COUNTRIES).map(([countryCode, name]) => ({
        value: countryCode,
        label: name,
        alternativeLabels: COUNTRY_ALIASES[countryCode] ?? [],
      })),
      placeholder: 'Select countries',
    },
    buildLogic: (value: unknown | undefined) => {
      const valueArr = value as string[];
      return {
        in: [
          {
            var: `TRANSACTION:destinationPaymentDetails-country`,
          },
          valueArr,
        ],
      };
    },
  },
];
