import React from 'react';
import { Tag as AntTag } from 'antd';
import { ColumnDataType } from './types';
import RiskLevelTag from '@/components/library/RiskLevelTag';
import { RiskLevel } from '@/utils/risk-levels';
import {
  Amount,
  Assignment,
  CaseStatus,
  CountryCode as ApiCountryCode,
  CurrencyCode,
  InternalBusinessUser,
  InternalConsumerUser,
  KYCStatusDetails,
  RuleAction,
  Tag,
  RuleNature,
  TransactionState as ApiTransactionState,
  TransactionType,
  UserState,
} from '@/apis';
import { getUserName } from '@/utils/api/users';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { paymethodOptions, transactionType } from '@/utils/tags';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import TransactionStateTag from '@/components/ui/TransactionStateTag';
import CurrencySymbol from '@/components/ui/Currency';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';
import KeyValueTag from '@/components/ui/KeyValueTag';
import { PaymentMethod } from '@/utils/payments';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserLink from '@/components/UserLink';
import CaseStatusTag from '@/components/ui/CaseStatusTag';
import { RuleActionTag } from '@/components/rules/RuleActionTag';
import Money from '@/components/ui/Money';
import UserKycStatusTag from '@/components/ui/UserKycStatusTag';
import UserStateTag from '@/components/ui/UserStateTag';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { RULE_NATURE_LABELS, RULE_NATURE_OPTIONS } from '@/pages/rules/utils';

export const UNKNOWN: ColumnDataType<unknown> = {
  render: (value) => {
    if (
      value == null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return <>{value}</>;
    }
    return <>{JSON.stringify(value)}</>;
  },
  stringify: (value) => {
    if (
      value == null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return `${value ?? ''}`;
    }
    return JSON.stringify(value);
  },
  defaultWrapMode: 'OVERFLOW',
  autoFilterDataType: { kind: 'string' },
};

export const RULE_NATURE: ColumnDataType<RuleNature> = {
  render: (value) => {
    if (value == null) {
      return <></>;
    }
    return <AntTag>{RULE_NATURE_LABELS[value]}</AntTag>;
  },
  defaultWrapMode: 'OVERFLOW',
  autoFilterDataType: {
    kind: 'select',
    options: RULE_NATURE_OPTIONS,
    mode: 'SINGLE',
    displayMode: 'select',
  },
};

export const NUMBER: ColumnDataType<number> = {
  render: (value) => <>{value ?? 0}</>,
};

export const FLOAT: ColumnDataType<number> = {
  render: (value) => <>{value?.toFixed(2)}</>,
  stringify: (value) => `${value?.toFixed(2)}`,
};

export const STRING: ColumnDataType<string> = {
  render: (value) => <>{value}</>,
};

export const BOOLEAN: ColumnDataType<boolean> = {
  render: (value) => <>{value ? 'Yes' : 'No'}</>,
  stringify: (value) => (value ? 'Yes' : 'No'),
};

export const LONG_TEXT: ColumnDataType<string> = {
  render: (value) => <>{value}</>,
  defaultWrapMode: 'WRAP',
};

export const ID = (): ColumnDataType<string> => ({
  render: (value) => <>{value}</>,
});

export const RISK_LEVEL: ColumnDataType<RiskLevel> = {
  render: (value) => <RiskLevelTag level={value} />,
};

export const USER_NAME: ColumnDataType<InternalConsumerUser | InternalBusinessUser> = {
  render: (user, _) => {
    const userName = getUserName(user);
    return user ? <UserLink user={user}>{userName}</UserLink> : <>{userName}</>;
  },
  stringify: (value) => getUserName(value),
  defaultWrapMode: 'OVERFLOW',
};

export const USER_TYPE: ColumnDataType<
  InternalConsumerUser | InternalBusinessUser | null | undefined
> = {
  render: (user, _) => {
    const userName = getUserName(user);
    return user ? <UserLink user={user}>{userName}</UserLink> : <>{userName}</>;
  },
  stringify: (value) => getUserName(value),
  defaultWrapMode: 'OVERFLOW',
};

export const TRANSACTION_TYPE: ColumnDataType<TransactionType> = {
  render: (type) => <TransactionTypeTag transactionType={type as TransactionType} />,
  stringify: (value) => `${value}`,
  autoFilterDataType: {
    kind: 'select',
    options: transactionType,
    displayMode: 'list',
    mode: 'SINGLE',
  },
};

export const TRANSACTION_STATE: ColumnDataType<ApiTransactionState> = {
  render: (value) => <TransactionStateTag transactionState={value} />,
  stringify: (value) => `${value}`,
  autoFilterDataType: {
    kind: 'select',
    options: transactionType,
    displayMode: 'list',
    mode: 'MULTIPLE',
  },
};

export const DATE_TIME: ColumnDataType<number> = {
  render: (timestamp) => <TimestampDisplay timestamp={timestamp} />,
  stringify: (timestamp) => dayjs(timestamp).format(DEFAULT_DATE_TIME_FORMAT),
  autoFilterDataType: { kind: 'dateTimeRange' },
};

export const DATE: ColumnDataType<number> = {
  render: (timestamp) => <TimestampDisplay timestamp={timestamp} />,
  stringify: (timestamp) => dayjs(timestamp).format(DEFAULT_DATE_TIME_FORMAT),
  autoFilterDataType: { kind: 'dateTimeRange' },
};

export const MONEY: ColumnDataType<Amount> = {
  render: (value) => {
    return <Money amount={value} />;
  },
  stringify: (value) => (value ? `${value.amountCurrency} ${value.amountValue.toFixed(2)}` : ''),
  autoFilterDataType: { kind: 'dateTimeRange' },
};

export const MONEY_AMOUNT: ColumnDataType<number> = {
  render: (value) => {
    if (value !== undefined) {
      return <>{new Intl.NumberFormat().format(value)}</>;
    } else {
      return <>{value}</>;
    }
  },
  autoFilterDataType: { kind: 'dateTimeRange' },
};

export const MONEY_CURRENCY: ColumnDataType<CurrencyCode> = {
  render: (value) => {
    return <CurrencySymbol currency={value} />;
  },
};

export const MONEY_CURRENCIES: ColumnDataType<CurrencyCode> = {
  render: (value) => {
    return <CurrencySymbol currency={value} />;
  },
  autoFilterDataType: {
    kind: 'select',
    options: CURRENCIES_SELECT_OPTIONS,
    mode: 'MULTIPLE',
    displayMode: 'select',
  },
};

export const COUNTRY: ColumnDataType<ApiCountryCode> = {
  render: (value: ApiCountryCode | undefined) => {
    return <CountryDisplay isoCode={value} />;
  },
};

export const TAGS: ColumnDataType<Tag[]> = {
  render: (value) => {
    return (
      <>
        {value?.map((tag) => (
          <KeyValueTag key={tag.key} tag={tag} />
        ))}
      </>
    );
  },
  stringify: (value) => (value ?? []).map(({ key, value }) => `${key}:${value}`).join(','),
};

export const PAYMENT_METHOD: ColumnDataType<PaymentMethod> = {
  render: (value) => {
    return <PaymentMethodTag paymentMethod={value} />;
  },
  autoFilterDataType: {
    kind: 'select',
    options: paymethodOptions,
    displayMode: 'list',
    mode: 'SINGLE',
  },
};

export const CASE_STATUS: ColumnDataType<CaseStatus> = {
  render: (caseStatus) => {
    return caseStatus ? <CaseStatusTag caseStatus={caseStatus} /> : <></>;
  },
};

export const RULE_ACTION: ColumnDataType<RuleAction> = {
  render: (ruleAction) => {
    return ruleAction ? <RuleActionTag ruleAction={ruleAction} /> : <></>;
  },
};

export const RULE_ACTION_STATUS: ColumnDataType<RuleAction> = {
  render: (ruleAction) => {
    return ruleAction ? <RuleActionStatus ruleAction={ruleAction} /> : <></>;
  },
  autoFilterDataType: {
    kind: 'select',
    options: [
      { value: 'all', label: 'All' },
      { value: 'ALLOW', label: 'ALLOW' },
      { value: 'FLAG', label: 'FLAG' },
      { value: 'BLOCK', label: 'BLOCK' },
      { value: 'SUSPEND', label: 'SUSPEND' },
    ],
    displayMode: 'list',
    mode: 'SINGLE',
  },
};

export const ASSIGNMENTS: ColumnDataType<Assignment[]> = {
  render: (value) => {
    return <>{value?.map((x) => x.assigneeUserId).join(',')}</>;
  },
  stringify: (value) => `${value?.map((x) => x.assigneeUserId).join(',') ?? ''}`,
};

export const USER_KYC_STATUS_TAG: ColumnDataType<KYCStatusDetails> = {
  render: (kycStatusDetails) => {
    return kycStatusDetails ? <UserKycStatusTag kycStatusDetails={kycStatusDetails} /> : <></>;
  },
  stringify: (kycStatusDetails) => kycStatusDetails?.status ?? '',
};

export const USER_STATE_TAG: ColumnDataType<UserState> = {
  render: (value: UserState | undefined) => {
    return value ? <UserStateTag userState={value} /> : <></>;
  },
  stringify: (userState) => userState ?? '',
};
