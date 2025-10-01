import React, { useMemo } from 'react';
import { capitalize, uniqBy } from 'lodash';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { COUNTRIES, CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import {
  firstLetterUpper,
  humanizeAuto,
  humanizeConstant,
  humanizeSnakeCase,
} from '@flagright/lib/utils/humanize';
import { ColumnDataType, FullColumnDataType } from '../types';
import { CloseMessage, message } from '../../Message';
import PriorityTag from '../../PriorityTag';
import s from './index.module.less';
import SanctionsHitStatusTag from '@/components/ui/SanctionsHitStatusTag';
import RiskLevelTag from '@/components/library/Tag/RiskLevelTag';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';
import UserKycStatusTag from '@/components/library/Tag/UserKycStatusTag';
import UserStateTag from '@/components/library/Tag/UserStateTag';
import { RiskLevel } from '@/utils/risk-levels';
import {
  Address,
  AlertsQaSampling,
  Amount,
  Assignment,
  Case,
  CaseStatus,
  CountryCode as ApiCountryCode,
  CurrencyCode,
  InternalBusinessUser,
  InternalConsumerUser,
  KYCStatus,
  PepRank,
  Priority,
  RuleAction,
  RuleNature,
  SanctionsHitStatus as ApiSanctionsHitStatus,
  Tag as ApiTag,
  TransactionState as ApiTransactionState,
  UserState,
  TenantSettings,
} from '@/apis';
import { getUserLink, getUserName } from '@/utils/api/users';
import TransactionTypeDisplay from '@/components/library/TransactionTypeDisplay';
import { dayjs, DEFAULT_DATE_TIME_FORMAT, TIME_FORMAT_WITHOUT_SECONDS } from '@/utils/dayjs';
import TransactionStateDisplay from '@/components/ui/TransactionStateDisplay';
import {
  useTransactionStateLabel,
  FeatureEnabled,
  useRuleActionLabel,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import CurrencySymbol from '@/components/ui/Currency';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { PAYMENT_METHODS, PaymentMethod } from '@/utils/payments';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserLink from '@/components/UserLink';
import Money from '@/components/ui/Money';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { RULE_NATURE_LABELS, RULE_NATURE_OPTIONS } from '@/pages/rules/utils';
import TextInput from '@/components/library/TextInput';
import NumberInput from '@/components/library/NumberInput';
import TextArea from '@/components/library/TextArea';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { getAlertUrl, getCaseUrl, makeUrl } from '@/utils/routing';
import {
  findLastStatusForInReview,
  statusInProgressOrOnHold,
  statusInReview,
} from '@/utils/case-utils';
import { useCaseStatusesFromPermissions } from '@/utils/permissions/case-permission-filter';
import { useApi } from '@/api';
import { CaseStatusWithDropDown } from '@/pages/case-management-item/CaseStatusWithDropDown';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { TableItem, TableUser } from '@/pages/case-management/CaseTable/types';
import { DurationDisplay } from '@/components/ui/DurationDisplay';
import { formatDuration, getDuration } from '@/utils/time-utils';
import { SANCTIONS_HIT_STATUSS } from '@/apis/models-custom/SanctionsHitStatus';
import { TRANSACTION_STATES } from '@/apis/models-custom/TransactionState';
import { Option } from '@/components/library/Select';
import { formatNumber } from '@/utils/number';
import { ALERT_ITEM } from '@/utils/queries/keys';
import Tag from '@/components/library/Tag';
import { statusToOperationName } from '@/pages/case-management/components/StatusChangeButton';
import { PEP_RANKS } from '@/apis/models-custom/PepRank';
import Toggle from '@/components/library/Toggle';
import Tooltip from '@/components/library/Tooltip';

export const UNKNOWN: Required<Omit<FullColumnDataType<unknown>, 'export'>> &
  Pick<FullColumnDataType<unknown>, 'export'> = {
  render: (value): JSX.Element => {
    if (value == null) {
      return <>{value}</>;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <>{`${value}`}</>;
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

export const ENUM: FullColumnDataType<any> = {
  render: (value) => <>{value ? humanizeAuto(value) : '-'}</>,
  stringify: (value) => (value ? humanizeAuto(value) : '-'),
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
  render: (value) => <span>{Array.isArray(value) ? value.join(', ') : value}</span>,
  stringify: (value) => (Array.isArray(value) ? value.join(', ') : value ?? ''),
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <div className={s.maxWidth}>
        <TextInput
          value={Array.isArray(state) ? state.join(',') : state}
          onChange={(newValue) => {
            context.edit.onConfirm(newValue);
          }}
          enableEmptyString
        />
      </div>
    );
  },
};

export const STRING_MULTIPLE: ColumnDataType<string | string[]> = {
  render: (value) => <>{Array.isArray(value) ? value.join(', ') : value}</>,
  stringify: (value) => (Array.isArray(value) ? value.join(', ') : value ?? ''),
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <div className={s.maxWidth}>
        <TextInput
          value={Array.isArray(state) ? state.join(', ') : state}
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
      <Toggle
        value={state}
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
    mode: 'MULTIPLE',
    displayMode: 'list',
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

export const TRANSACTION_TYPE: ColumnDataType<string> = {
  render: (type) => <TransactionTypeDisplay transactionType={type} />,
  stringify: (value) => `${value}`,
};

export const TRANSACTION_STATE: ColumnDataType<ApiTransactionState> = {
  render: (value) => <TransactionStateDisplay transactionState={value} />,
  stringify: (value) => `${value}`,
  autoFilterDataType: {
    kind: 'select',
    options: TRANSACTION_STATES.map((type) => ({
      value: type,
      label: <TransactionStateAliasText transactionState={type} />,
    })),
    displayMode: 'list',
    mode: 'MULTIPLE',
  },
};

function TransactionStateAliasText(props: { transactionState: ApiTransactionState }) {
  const label = useTransactionStateLabel(props.transactionState);
  return <>{label}</>;
}

export const SANCTIONS_HIT_STATUS: ColumnDataType<ApiSanctionsHitStatus> = {
  render: (value) => <SanctionsHitStatusTag status={value} />,
  stringify: (value) => `${value}`,
  autoFilterDataType: {
    kind: 'select',
    options: SANCTIONS_HIT_STATUSS.map((type) => ({
      value: type,
      label: humanizeConstant(type),
    })),
    displayMode: 'list',
    mode: 'MULTIPLE',
  },
};

export const SANCTIONS_CLEAR_REASON: ColumnDataType<string[]> = {
  render: (clearing_reasons) => {
    return (
      <div className={s.tags}>
        {clearing_reasons?.map((clearingReason: string) => (
          <Tag key={clearingReason} color="gray">
            {humanizeSnakeCase(clearingReason)}
          </Tag>
        ))}
      </div>
    );
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
  stringify: (value) =>
    value && value.amountCurrency && value.amountCurrency
      ? `${value.amountCurrency} ${value.amountValue.toFixed(2)}`
      : '',
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

export const QA_SAMPLE_ID: ColumnDataType<
  string,
  Pick<AlertsQaSampling, 'samplingId' | 'samplingType'>
> = {
  render: (value, { item: entity }) => {
    return (
      <>
        <div className={s.sampleIdColContainer}>
          {entity?.samplingId && (
            <div className={s.samplingId}>
              <Id
                to={addBackUrlToRoute(`/case-management/qa-sampling/${entity.samplingId}`)}
                testName="sampling-id"
              >
                {entity.samplingId}
              </Id>
              {entity.samplingType === 'MANUAL' && <Tag color="gold">Manual</Tag>}
            </div>
          )}
        </div>
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

export const MONEY_AMOUNT = (currency?: string): ColumnDataType<number> => ({
  render: (value) => {
    if (value !== undefined && value !== null) {
      if (currency) {
        return <Money value={Number(value)} currency={currency} />;
      }
      return <>{new Intl.NumberFormat().format(value)}</>;
    } else {
      return <>{value}</>;
    }
  },
  stringify: (value) => {
    if (value !== undefined && value !== null) {
      if (currency) {
        return `${currency} ${new Intl.NumberFormat().format(Number(value))}`;
      }
      return new Intl.NumberFormat().format(value);
    }
    return String(value || '');
  },
  autoFilterDataType: { kind: 'dateTimeRange' },
});

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
  render: (value) => {
    return <CountryDisplay isoCode={value} />;
  },
  stringify: (value) => {
    return value ? COUNTRIES[value] : '';
  },
  autoFilterDataType: {
    kind: 'select',
    mode: 'MULTIPLE',
    displayMode: 'select',
    options: Object.entries(COUNTRIES).map(([isoCode, country]) => ({
      value: isoCode,
      label: country,
    })),
  },
};

export const PEP_RANK: ColumnDataType<PepRank> = {
  render: (value) => <>{value}</>,
  autoFilterDataType: {
    kind: 'select',
    options: PEP_RANKS.map((type) => ({
      value: type,
      label: humanizeConstant(type),
    })),
    mode: 'SINGLE',
    displayMode: 'select',
  },
};

export const COUNTRIES_MULTIPLE: ColumnDataType<ApiCountryCode | ApiCountryCode[]> = {
  render: (value) => {
    return (
      <>
        {Array.isArray(value) ? (
          value.map((isoCode, index) => <CountryDisplay isoCode={isoCode} key={index} />)
        ) : (
          <CountryDisplay isoCode={value} />
        )}
      </>
    );
  },
  stringify: (value) => {
    return Array.isArray(value)
      ? value.map((isoCode) => COUNTRIES[isoCode]).join(',')
      : value
      ? COUNTRIES[value]
      : '';
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
        message.fatal(`Error updating status: ${error.message}`);
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
}): ColumnDataType<CaseStatus, T> => {
  const allowedStatuses = useCaseStatusesFromPermissions();

  return {
    render: (caseStatus, { item: entity }) => {
      return caseStatus && entity ? (
        statusInProgressOrOnHold(caseStatus) ? (
          <Tooltip
            title={humanizeConstant(
              caseStatus.replace('_IN_PROGRESS', ', In Progress').replace('_ON_HOLD', ', On Hold'),
            )}
          >
            <StatusChangeDropDown<T>
              entity={entity}
              caseStatus={caseStatus}
              reload={options?.reload ?? (() => {})}
            />
          </Tooltip>
        ) : (
          <StatusChangeDropDown<T>
            entity={entity}
            caseStatus={caseStatus}
            reload={options?.reload ?? (() => {})}
          />
        )
      ) : (
        <></>
      );
    },
    stringify: (value) => {
      return value ? statusToOperationName(value, true) : '-';
    },
    autoFilterDataType: {
      kind: 'select',
      options: uniqBy<Option<string>>(
        (options?.statusesToShow ?? allowedStatuses).map((status) => ({
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
  };
};
export const STATUS_CHANGE_PATH = (entityType: 'CASE' | 'ALERT') => {
  return {
    stringify: (value, entity) => {
      const currentStatus = entity[`${entityType.toLowerCase()}Status`];
      const statusChangesPath = [
        'Open',
        ...(value?.map((statusChange) =>
          statusChange.caseStatus ? statusToOperationName(statusChange.caseStatus, true) : '-',
        ) ?? [
          ...(currentStatus !== 'OPEN' && currentStatus
            ? [statusToOperationName(currentStatus, true)]
            : []),
        ]),
      ].join(' -> ');
      return statusChangesPath;
    },
  };
};
export const RULE_ACTION_STATUS: ColumnDataType<RuleAction> = {
  render: (ruleAction) => {
    return ruleAction ? <RuleActionStatus ruleAction={ruleAction} /> : <></>;
  },
  autoFilterDataType: {
    kind: 'select',
    options: [
      { value: 'all', label: 'All' },
      { value: 'ALLOW', label: <RuleActionAliasText ruleAction="ALLOW" /> },
      { value: 'FLAG', label: <RuleActionAliasText ruleAction="FLAG" /> },
      { value: 'BLOCK', label: <RuleActionAliasText ruleAction="BLOCK" /> },
      { value: 'SUSPEND', label: <RuleActionAliasText ruleAction="SUSPEND" /> },
    ],
    displayMode: 'list',
    mode: 'SINGLE',
  },
};

function RuleActionAliasText(props: { ruleAction: RuleAction }) {
  const label = useRuleActionLabel(props.ruleAction);
  return <>{label}</>;
}

export const ASSIGNMENTS: ColumnDataType<Assignment[]> = {
  render: (value) => {
    return <>{value?.map((x) => x.assigneeUserId).join(',')}</>;
  },
  stringify: (value) => `${value?.map((x) => x.assigneeUserId).join(',') ?? ''}`,
};

export const USER_KYC_STATUS_TAG: ColumnDataType<KYCStatus> = {
  render: (kycStatus) => {
    return kycStatus ? <UserKycStatusTag kycStatusDetails={{ status: kycStatus }} /> : <></>;
  },
  stringify: (kycStatus) => kycStatus ?? '',
};

export const USER_STATE_TAG: ColumnDataType<UserState> = {
  render: (value: UserState | undefined) => {
    return value ? <UserStateTag userState={value} /> : <></>;
  },
  stringify: (userState) => userState ?? '',
};

export const TAG_LIST: ColumnDataType<string | string[] | undefined> = {
  render: (value: string | string[] | undefined) => {
    if (Array.isArray(value)) {
      return (
        <>
          {value.map((x, index) => (
            <Tag key={index}>{capitalize(x)}</Tag>
          ))}
        </>
      );
    }
    return value ? <Tag>{capitalize(value)}</Tag> : <></>;
  },
  stringify: (value) => (Array.isArray(value) ? value.join(',') : value ?? ''),
};

export const TAG: ColumnDataType<string | undefined> = {
  render: (value: string | undefined) => {
    return <Tag>{capitalize(value)}</Tag>;
  },
  stringify: (value) => value ?? '',
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
      <div className={s.address}>
        <div>
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
        </div>
        {[
          address.addressType ? (
            <KeyValueTag key="addressType" tag={{ key: 'Type', value: address.addressType }} />
          ) : undefined,
          ...(address.tags?.map((tag) => <KeyValueTag key={tag.key} tag={tag} />) ?? []),
        ].filter(Boolean)}
      </div>
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

export const getForneticsEntityId = (tenantSettings?: TenantSettings) => {
  return {
    render: (value, { item }) => {
      const entity = item as object;
      const key = Object.keys(entity).find((key) => entity?.[key] === value);
      switch (key) {
        case `${firstLetterUpper(tenantSettings?.userAlias ?? 'User')} ID`:
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
            <FeatureEnabled name={'ALERT_DETAILS_PAGE'}>
              {(alertPageEnabled) => (
                <Id
                  to={addBackUrlToRoute(
                    getAlertUrl(entity?.['Case ID'], value ?? '#', alertPageEnabled),
                  )}
                  toNewTab
                >
                  {value}
                </Id>
              )}
            </FeatureEnabled>
          );
        case 'caseId':
          return (
            <Id to={addBackUrlToRoute(getCaseUrl(value ?? '#'))} testName="case-id" toNewTab={true}>
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
};

export const SIMULATION_STATUS = {
  render: (value) => {
    const isSuccess = value?.every((iteration) => iteration.latestStatus.status === 'SUCCESS');
    const isFailed = value?.some((iteration) => {
      const now = dayjs();
      const createdAt = dayjs(iteration.createdAt);
      const status = iteration.latestStatus.status;
      return (
        status === 'FAILED' ||
        ((status === 'IN_PROGRESS' || status === 'PENDING') && now.diff(createdAt, 'hours') > 24)
      );
    });
    const color = isSuccess ? 'green' : isFailed ? 'red' : 'orange';
    const statusText = isSuccess ? 'Done' : isFailed ? 'Failed' : 'In Progress';
    return isSuccess || isFailed ? (
      <Tag color={color}>{statusText}</Tag>
    ) : (
      <div className={s.tags}>
        {value?.map((iteration, index) => {
          const status = iteration.latestStatus.status;
          const progress = Math.trunc(iteration.progress * 100);
          return (
            <Tag
              key={index}
              color={status === 'SUCCESS' ? 'green' : status === 'FAILED' ? 'red' : 'orange'}
            >
              Iteration {index + 1}: {progress}%
            </Tag>
          );
        })}
      </div>
    );
  },
};

export const TRANSACTION_ID = (escalatedTransactions?: string[]) => ({
  ...STRING,
  render: (value: string | undefined) => {
    return (
      <div style={{ overflowWrap: 'anywhere' }}>
        <Id to={makeUrl(`/transactions/item/:id`, { id: value })} testName="transaction-id">
          {value}
        </Id>
        {escalatedTransactions && value != null && escalatedTransactions?.indexOf(value) > -1 && (
          <>
            <br />
            <Tag color="blue">Escalated</Tag>
          </>
        )}
      </div>
    );
  },
  link: (value) => makeUrl(`/transactions/item/:id`, { id: value }),
  stringify(value) {
    return `${value}`;
  },
});
