import React, { useMemo } from 'react';
import { Switch } from 'antd';
import { capitalize, uniqBy } from 'lodash';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { COUNTRIES, CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import { ColumnDataType, FullColumnDataType } from '../types';
import { CloseMessage, message } from '../../Message';
import PriorityTag from '../../PriorityTag';
import s from './index.module.less';
import RiskLevelTag from '@/components/library/Tag/RiskLevelTag';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';
import UserKycStatusTag from '@/components/library/Tag/UserKycStatusTag';
import UserStateTag from '@/components/library/Tag/UserStateTag';
import { RiskLevel } from '@/utils/risk-levels';
import {
  Address,
  Amount,
  Assignment,
  CaseStatus,
  CountryCode as ApiCountryCode,
  CurrencyCode,
  InternalBusinessUser,
  InternalConsumerUser,
  KYCStatusDetails,
  RuleAction,
  RuleNature,
  Tag as ApiTag,
  TransactionState as ApiTransactionState,
  TransactionType,
  UserState,
  Case,
  Priority,
  Alert,
  AlertsQaSampling,
} from '@/apis';
import { getUserLink, getUserName } from '@/utils/api/users';
import TransactionTypeDisplay from '@/components/library/TransactionTypeDisplay';
import { dayjs, DEFAULT_DATE_TIME_FORMAT, TIME_FORMAT_WITHOUT_SECONDS } from '@/utils/dayjs';
import TransactionStateDisplay from '@/components/ui/TransactionStateDisplay';
import CurrencySymbol from '@/components/ui/Currency';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { PAYMENT_METHODS, PaymentMethod } from '@/utils/payments';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserLink from '@/components/UserLink';
import { RuleActionTag } from '@/components/library/Tag/RuleActionTag';
import Money from '@/components/ui/Money';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { RULE_NATURE_LABELS, RULE_NATURE_OPTIONS } from '@/pages/rules/utils';
import TextInput from '@/components/library/TextInput';
import NumberInput from '@/components/library/NumberInput';
import TextArea from '@/components/library/TextArea';
import { humanizeConstant } from '@/utils/humanize';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { getAlertUrl, getCaseUrl, makeUrl } from '@/utils/routing';
import { findLastStatusForInReview, statusInReview } from '@/utils/case-utils';
import { CASE_STATUSS } from '@/apis/models-custom/CaseStatus';
import { useApi } from '@/api';
import { CaseStatusWithDropDown } from '@/pages/case-management-item/CaseStatusWithDropDown';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { TableItem, TableUser } from '@/pages/case-management/CaseTable/types';
import { DurationDisplay } from '@/components/ui/DurationDisplay';
import { getDuration, formatDuration } from '@/utils/time-utils';
import { TRANSACTION_STATES } from '@/apis/models-custom/TransactionState';
import { TRANSACTION_TYPES } from '@/apis/models-custom/TransactionType';
import { Option } from '@/components/library/Select';
import { formatNumber } from '@/utils/number';
import { ALERT_ITEM } from '@/utils/queries/keys';
import Tag from '@/components/library/Tag';

export const UNKNOWN: Required<FullColumnDataType<unknown>> = {
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
  renderEdit: (context) => {
    const [value] = context.edit.state;
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
  defaultWrapMode: 'WRAP',
  autoFilterDataType: { kind: 'string' },
  link: () => '',
};

export const NUMBER: ColumnDataType<number> = {
  render: (value) => <span>{formatNumber(value ?? 0)}</span>,
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <div className={s.maxWidth}>
        <NumberInput
          step={1}
          value={state}
          onChange={(newValue) => {
            context.edit.onConfirm(newValue);
          }}
        />
      </div>
    );
  },
};

export const FLOAT: ColumnDataType<number> = {
  render: (value) => <span>{formatNumber(value ?? 0.0, { keepDecimals: true })}</span>,
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <div className={s.maxWidth}>
        <NumberInput
          value={state}
          onChange={(newValue) => {
            context.edit.onConfirm(newValue);
          }}
        />
      </div>
    );
  },
  stringify: (value) => `${(value ?? 0.0)?.toFixed(2)}`,
};

export const STRING: ColumnDataType<string> = {
  render: (value) => <span>{value}</span>,
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <div className={s.maxWidth}>
        <TextInput
          value={state}
          onChange={(newValue) => {
            context.edit.onConfirm(newValue);
          }}
          enableEmptyString
        />
      </div>
    );
  },
};

export const LONG_TEXT: ColumnDataType<string> = {
  render: (value) => <span>{value}</span>,
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <div className={s.maxWidth}>
        <TextArea
          className={s.textArea}
          value={state}
          onChange={(newValue) => {
            context.edit.onConfirm(newValue);
          }}
        />
      </div>
    );
  },
  defaultWrapMode: 'WRAP',
};

export const BOOLEAN: ColumnDataType<boolean> = {
  render: (value) => <>{value ? 'Yes' : 'No'}</>,
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <Switch
        checked={state}
        onChange={(checked) => {
          context.edit.onConfirm(checked);
        }}
      />
    );
  },
  stringify: (value) => (value ? 'Yes' : 'No'),
  autoFilterDataType: {
    kind: 'select',
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
    mode: 'SINGLE',
    displayMode: 'list',
  },
};

export const RULE_NATURE: ColumnDataType<RuleNature> = {
  render: (value) => {
    if (value == null) {
      return <></>;
    }
    return <Tag>{RULE_NATURE_LABELS[value]}</Tag>;
  },
  defaultWrapMode: 'WRAP',
  autoFilterDataType: {
    kind: 'select',
    options: RULE_NATURE_OPTIONS,
    mode: 'SINGLE',
    displayMode: 'select',
  },
};

export const ID: ColumnDataType<string> = {
  render: (value) => <Id>{value}</Id>,
  stringify: (value) => `${value}`,
};

export const ALERT_USER_ID: ColumnDataType<string, TableAlertItem> = {
  render: (value, { item: entity }) => {
    return (
      <>
        {entity?.caseId && (
          <Id to={addBackUrlToRoute(getUserLink(entity?.user))} testName="alert-user-id">
            {value}
          </Id>
        )}
      </>
    );
  },
  stringify(value) {
    return `${value ?? ''}`;
  },
  link(value, item) {
    return getUserLink(item?.user);
  },
};

export const RISK_LEVEL: ColumnDataType<RiskLevel> = {
  render: (value) => <RiskLevelTag level={value} />,
};

export const CASE_USER_NAME: FullColumnDataType<TableUser> = {
  render: (user, _) => {
    const userName = getUserName(user);
    return user ? <UserLink user={user}>{userName}</UserLink> : <>{userName}</>;
  },
  stringify: (value) => getUserName(value),
  defaultWrapMode: 'WRAP',
};

export const TRANSACTION_USER_NAME: FullColumnDataType<
  InternalConsumerUser | InternalBusinessUser
> = {
  render: (user, _) => {
    const userName = getUserName(user);
    return user ? <UserLink user={user}>{userName}</UserLink> : <>{userName}</>;
  },
  stringify: (value) => getUserName(value),
  defaultWrapMode: 'WRAP',
};

export const USER_TYPE: ColumnDataType<
  InternalConsumerUser | InternalBusinessUser | null | undefined
> = {
  render: (user, _) => {
    const userName = getUserName(user);
    return user ? <UserLink user={user}>{userName}</UserLink> : <>{userName}</>;
  },
  stringify: (value) => getUserName(value),
  defaultWrapMode: 'WRAP',
};

export const TRANSACTION_TYPE: ColumnDataType<TransactionType> = {
  render: (type) => <TransactionTypeDisplay transactionType={type as TransactionType} />,
  stringify: (value) => `${value}`,
  autoFilterDataType: {
    kind: 'select',
    options: TRANSACTION_TYPES.map((type) => ({
      value: type,
      label: humanizeConstant(type),
    })),
    displayMode: 'list',
    mode: 'SINGLE',
  },
};

export const TRANSACTION_STATE: ColumnDataType<ApiTransactionState> = {
  render: (value) => <TransactionStateDisplay transactionState={value} />,
  stringify: (value) => `${value}`,
  autoFilterDataType: {
    kind: 'select',
    options: TRANSACTION_STATES.map((type) => ({
      value: type,
      label: humanizeConstant(type),
    })),
    displayMode: 'list',
    mode: 'MULTIPLE',
  },
};

export const DATE_TIME: ColumnDataType<number> = {
  render: (timestamp) => <TimestampDisplay timestamp={timestamp} />,
  stringify: (timestamp) => dayjs(timestamp).format(DEFAULT_DATE_TIME_FORMAT),
  autoFilterDataType: { kind: 'dateTimeRange' },
};

export const DURATION: ColumnDataType<number> = {
  render: (milliseconds) => <DurationDisplay milliseconds={milliseconds} />,
  stringify: (milliseconds) => (milliseconds ? formatDuration(getDuration(milliseconds)) : ''),
};

export const DATE: ColumnDataType<number> = {
  render: (timestamp) => (
    <TimestampDisplay timestamp={timestamp} timeFormat={TIME_FORMAT_WITHOUT_SECONDS} />
  ),
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

export const CASEID: ColumnDataType<string, Pick<Case, 'caseId'>> = {
  render: (_value, { item: entity }) => {
    return (
      <>
        {entity?.caseId && (
          <Id to={addBackUrlToRoute(getCaseUrl(entity.caseId))} testName="case-id">
            {entity.caseId}
          </Id>
        )}
      </>
    );
  },
  stringify(value, item) {
    return `${item?.caseId ?? ''}`;
  },
  link(value) {
    return value ? getCaseUrl(value) : '';
  },
};

export const QA_SAMPLE_ID: ColumnDataType<string, Pick<AlertsQaSampling, 'samplingId'>> = {
  render: (value, { item: entity }) => {
    return (
      <>
        {entity?.samplingId && (
          <Id
            to={addBackUrlToRoute(`/case-management/qa-sampling/${entity.samplingId}`)}
            testName="sampling-id"
          >
            {entity.samplingId}
          </Id>
        )}
      </>
    );
  },
  stringify(value, item) {
    return `${item?.samplingId ?? ''}`;
  },
  link(value, item) {
    return item?.samplingId ? `/case-management/qa-samples/${item.samplingId}` : '';
  },
};

export const ALERT_ID: ColumnDataType<string, Pick<Alert, 'caseId'>> = {
  render: (alertId, { item: entity }) => {
    return (
      <>
        {entity?.caseId && alertId && (
          <Id to={addBackUrlToRoute(getAlertUrl(entity.caseId, alertId))} testName="alert-id">
            {alertId}
          </Id>
        )}
      </>
    );
  },
  stringify(value, item) {
    return `${item?.caseId ?? ''}`;
  },
  link(value, item) {
    return item?.caseId && value ? getAlertUrl(item.caseId, value) : '';
  },
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
  stringify: (value: ApiCountryCode | undefined) => {
    return value ? COUNTRIES[value] : '';
  },
};

export const TAGS: ColumnDataType<ApiTag[]> = {
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
    options: PAYMENT_METHODS.map((type) => ({
      value: type,
      label: humanizeConstant(type),
    })),
    displayMode: 'list',
    mode: 'SINGLE',
  },
};

const StatusChangeDropDown = <T extends TableItem | TableAlertItem>(props: {
  entity: T;
  caseStatus: CaseStatus;
  reload: () => void;
}) => {
  const { entity, caseStatus, reload } = props;
  const api = useApi();
  let messageState: CloseMessage | undefined;
  const alertId = 'alertId' in entity ? entity?.alertId : undefined;
  const caseId = entity?.caseId;
  const queryClient = useQueryClient();

  const updateMutation = useMutation(
    async (status: CaseStatus) => {
      if (!alertId && caseId) {
        messageState = message.loading('Updating case status...');
        return await api.patchCasesStatusChange({
          CasesStatusUpdateRequest: {
            caseIds: [caseId],
            updates: {
              reason: [],
              caseStatus: status,
            },
          },
        });
      } else if (alertId) {
        messageState = message.loading('Updating alert status...');
        await api.alertsStatusChange({
          AlertsStatusUpdateRequest: {
            alertIds: [alertId],
            updates: {
              reason: [],
              alertStatus: status,
            },
          },
        });
        return alertId;
      }
    },
    {
      onSuccess: (alertId) => {
        message.success('Status updated');
        if (alertId) {
          queryClient.refetchQueries({ queryKey: ALERT_ITEM(alertId) });
        }
        messageState?.();
        reload();
      },
      onError: (error: Error) => {
        message.error(`Error updating status: ${error.message}`);
        messageState?.();
        reload();
      },
    },
  );

  const previousStatus = useMemo(() => {
    return findLastStatusForInReview(entity?.statusChanges ?? []);
  }, [entity?.statusChanges]);

  return (
    <CaseStatusWithDropDown
      caseStatus={caseStatus}
      previousStatus={previousStatus}
      assignments={entity?.assignments ?? []}
      onSelect={(status) => updateMutation.mutate(status)}
      statusChanges={entity?.statusChanges ?? []}
      reviewAssignments={entity?.reviewAssignments ?? []}
    />
  );
};

export const CASE_STATUS = <T extends TableAlertItem | TableItem>(options?: {
  statusesToShow?: CaseStatus[];
  reload: () => void;
}): ColumnDataType<CaseStatus, T> => ({
  render: (caseStatus, { item: entity }) => {
    return caseStatus && entity ? (
      <StatusChangeDropDown<T>
        entity={entity}
        caseStatus={caseStatus}
        reload={options?.reload ?? (() => {})}
      />
    ) : (
      <></>
    );
  },
  autoFilterDataType: {
    kind: 'select',
    options: uniqBy<Option<string>>(
      (options?.statusesToShow ?? CASE_STATUSS).map((status) => ({
        value: status,
        label: humanizeConstant(
          statusInReview(status)
            ? 'IN_REVIEW'
            : status.endsWith('IN_PROGRESS')
            ? 'IN_PROGRESS'
            : status.endsWith('ON_HOLD')
            ? 'ON_HOLD'
            : status,
        ),
      })),
      'label',
    ),
    displayMode: 'list',
    mode: 'SINGLE',
  },
});

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

export const TAG: ColumnDataType<string> = {
  render: (value: string | undefined) => {
    return value ? <Tag>{capitalize(value)}</Tag> : <></>;
  },
  stringify: (userState) => userState ?? '',
};

export const EXTERNAL_LINK: ColumnDataType<string> = {
  render: (link) => {
    let url = link;
    if (!link?.startsWith('http://') && !link?.startsWith('https://')) {
      url = `https://${link}`;
    }
    return (
      <div>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {link}
        </a>
      </div>
    );
  },
};

export const EMAIL: ColumnDataType<string> = {
  render: (email) => {
    return (
      <div className={s.email}>
        <a href={`mailto:${email}`}>{email}</a>
      </div>
    );
  },
};

export const FAX: ColumnDataType<string> = {
  render: (fax) => {
    return (
      <div className={s.fax}>
        <a>
          <b className={s.text}>{fax}</b>
        </a>
      </div>
    );
  },
};

export const PHONE: ColumnDataType<string> = {
  render: (tel) => {
    return (
      <div className={s.phone}>
        <a>
          <b className={s.text}>{tel}</b>
        </a>
      </div>
    );
  },
};

export const ADDRESS: ColumnDataType<Address> = {
  render: (address) => {
    if (address == null) {
      return <></>;
    }
    return (
      <p>
        {[
          ...address.addressLines,
          [address.city, address.state].filter((x) => !!x).join(', '),
          address.postcode,
          address.country,
        ]
          .filter((x) => !!x)
          .map((str, j) => (
            <React.Fragment key={j}>
              {j !== 0 && <br />}
              {str}
            </React.Fragment>
          ))}
      </p>
    );
  },
};

export const PRIORITY: ColumnDataType<Priority> = {
  render: (priority) => {
    if (priority == null) {
      return <></>;
    }
    return <PriorityTag priority={priority} />;
  },
};

export const FORENSICS_ENTITY_ID: ColumnDataType<string> = {
  render: (value, { item }) => {
    const entity = item as object;
    const key = Object.keys(entity).find((key) => entity?.[key] === value);
    switch (key) {
      case 'User ID':
        return (
          <Id
            to={addBackUrlToRoute(
              makeUrl(`/users/list/:list/:id`, {
                list: entity?.['User type'] === 'CONSUMER' ? 'consumer' : 'business',
                id: value,
              }),
            )}
            toNewTab
          >
            {value}
          </Id>
        );
      case 'Alert ID':
        return (
          <Id to={addBackUrlToRoute(getAlertUrl(entity?.['Case ID'], value ?? '#'))} toNewTab>
            {value}
          </Id>
        );
      case 'Case ID':
      case 'Related case':
        return (
          <Id to={addBackUrlToRoute(getCaseUrl(value ?? '#'))} toNewTab>
            {value}
          </Id>
        );
      case 'Transaction ID':
        return (
          <Id
            to={addBackUrlToRoute(
              makeUrl(`/transactions/item/:id`, {
                id: value,
              }),
            )}
            toNewTab
          >
            {value}
          </Id>
        );
      case 'SAR ID':
        return (
          <Id
            to={addBackUrlToRoute(
              makeUrl(`/reports/:id`, {
                id: value,
              }),
            )}
            toNewTab
          >
            {value}
          </Id>
        );
      default:
        return <Id>{value}</Id>;
    }
  },
};
