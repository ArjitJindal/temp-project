import React, { useMemo } from 'react';
import { Switch, Tag as AntTag } from 'antd';
import { uniqBy } from 'lodash';
import { useMutation } from '@tanstack/react-query';
import { ColumnDataType, FullColumnDataType } from '../types';
import { CloseMessage, message } from '../../Message';
import PriorityTag from '../../PriorityTag';
import s from './index.module.less';
import RiskLevelTag from '@/components/library/RiskLevelTag';
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
  Tag,
  TransactionState as ApiTransactionState,
  TransactionType,
  UserState,
  Case,
  Priority,
} from '@/apis';
import { getUserName } from '@/utils/api/users';
import TransactionTypeTag from '@/components/library/TransactionTypeTag';
import { paymethodOptions, transactionState, transactionType } from '@/utils/tags';
import { dayjs, DEFAULT_DATE_TIME_FORMAT, TIME_FORMAT_WITHOUT_SECONDS } from '@/utils/dayjs';
import TransactionStateTag from '@/components/ui/TransactionStateTag';
import CurrencySymbol from '@/components/ui/Currency';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';
import KeyValueTag from '@/components/ui/KeyValueTag';
import { PaymentMethod } from '@/utils/payments';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserLink from '@/components/UserLink';
import { RuleActionTag } from '@/components/rules/RuleActionTag';
import Money from '@/components/ui/Money';
import UserKycStatusTag from '@/components/ui/UserKycStatusTag';
import UserStateTag from '@/components/ui/UserStateTag';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { RULE_NATURE_LABELS, RULE_NATURE_OPTIONS } from '@/pages/rules/utils';
import TextInput from '@/components/library/TextInput';
import NumberInput from '@/components/library/NumberInput';
import TextArea from '@/components/library/TextArea';
import { humanizeConstant } from '@/utils/humanize';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import { findLastStatusForInReview, statusInReview } from '@/utils/case-utils';
import { CASE_STATUSS } from '@/apis/models-custom/CaseStatus';
import { useApi } from '@/api';
import { CaseStatusWithDropDown } from '@/pages/case-management-item/CaseStatusWithDropDown';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { TableItem } from '@/pages/case-management/CaseTable/types';
import { DurationDisplay } from '@/components/ui/DurationDisplay';
import { getDuration, formatDuration } from '@/utils/time-utils';
import {
  COLORS_V2_HIGHLIGHT_FLAGRIGHTBLUE,
  COLORS_V2_HIGHLIGHT_HIGHLIGHT_STROKE,
} from '@/components/ui/colors';

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
};

export const NUMBER: ColumnDataType<number> = {
  render: (value) => <span>{value ?? 0}</span>,
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
  render: (value) => <span>{value?.toFixed(2)}</span>,
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
  stringify: (value) => `${value?.toFixed(2)}`,
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
};

export const RULE_NATURE: ColumnDataType<RuleNature> = {
  render: (value) => {
    if (value == null) {
      return <></>;
    }
    return <AntTag>{RULE_NATURE_LABELS[value]}</AntTag>;
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
};

export const RISK_LEVEL: ColumnDataType<RiskLevel> = {
  render: (value) => <RiskLevelTag level={value} />,
};

export const USER_NAME: FullColumnDataType<InternalConsumerUser | InternalBusinessUser> = {
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
    options: transactionState,
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

export const CASEID_PRIORITY: ColumnDataType<string, Case> = {
  render: (_value, { item: entity }) => {
    const tagStyle = {
      background: COLORS_V2_HIGHLIGHT_FLAGRIGHTBLUE,
      borderColor: COLORS_V2_HIGHLIGHT_HIGHLIGHT_STROKE,
      color: 'black',
    };

    return (
      <>
        {entity?.caseId && (
          <Id
            to={addBackUrlToRoute(
              makeUrl(`/case-management/case/:caseId`, {
                caseId: entity.caseId,
              }),
            )}
            testName="case-id"
          >
            {entity.caseId}
          </Id>
        )}
        <div className={s.casePriority}>
          <div style={{ marginBottom: 0 }}>
            {entity?.priority && <p style={{ marginBottom: 0 }}>Priority: {entity.priority}</p>}
          </div>
          <div style={{ marginBottom: 0 }}>
            {entity?.caseType === 'MANUAL' && <AntTag style={tagStyle}>Manual</AntTag>}
          </div>
        </div>
      </>
    );
  },
  defaultWrapMode: 'OVERFLOW',
};

export const CASEID: ColumnDataType<string, Case> = {
  render: (_value, { item: entity }) => {
    return (
      <>
        {entity?.caseId && (
          <Id
            to={addBackUrlToRoute(
              makeUrl(`/case-management/case/:caseId`, {
                caseId: entity.caseId,
              }),
            )}
            testName="case-id"
          >
            {entity.caseId}
          </Id>
        )}
      </>
    );
  },
};
export const ALERT_ID: ColumnDataType<string, Case> = {
  render: (alertId, { item: entity }) => {
    return (
      <>
        {entity?.caseId && (
          <Id
            to={addBackUrlToRoute(
              makeUrl(`/case-management/case/:caseId/:tab`, {
                caseId: entity.caseId,
                tab: 'alerts',
              }),
            )}
            testName="alert-id"
          >
            {alertId}
          </Id>
        )}
      </>
    );
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

const StatusChangeDropDown = <T extends TableItem | TableAlertItem>(props: {
  entity: T | null;
  caseStatus: CaseStatus;
  reload: () => void;
}) => {
  const { entity, caseStatus, reload } = props;
  const api = useApi();
  let messageState: CloseMessage | undefined;
  const alertId = (entity as TableAlertItem)?.alertId;
  const caseId = entity?.caseId;

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
        return await api.alertsStatusChange({
          AlertsStatusUpdateRequest: {
            alertIds: [alertId],
            updates: {
              reason: [],
              alertStatus: status,
            },
          },
        });
      }
    },
    {
      onSuccess: () => {
        message.success('Status updated');
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
    return caseStatus ? (
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
    options: uniqBy(
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

export const EXTERNAL_LINK: ColumnDataType<string> = {
  render: (link) => {
    return (
      <div>
        <a href={link} target="_blank">
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
