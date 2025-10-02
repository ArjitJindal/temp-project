import { UserOutlined } from '@ant-design/icons';
import {
  firstLetterUpper,
  humanizeConstant,
  humanizeSnakeCase,
} from '@flagright/lib/utils/humanize';
import { map, mapKeys, pickBy, range } from 'lodash';
import { MAX_SLA_POLICIES_PER_ENTITY } from '@flagright/lib/constants';
import PaymentMethodButton from '../transactions/components/PaymentMethodButton';
import SlaFilter from './components/SlaFilter';
import { getPolicyTime } from './components/SlaStatus/SlaPolicyDetails';
import { AccountsFilter } from '@/components/library/AccountsFilter';
import GavelIcon from '@/components/ui/icons/Remix/design/focus-2-line.react.svg';
import { dayjs } from '@/utils/dayjs';
import '../../components/ui/colors';
import { Adapter } from '@/utils/routing';
import { isRuleAction, isTransactionState, useRuleOptions } from '@/utils/rules';
import { TableSearchParams } from '@/pages/case-management/types';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import TransactionTagSearchButton from '@/pages/transactions/components/TransactionTagSearchButton';
import { RiskLevelButton } from '@/pages/users/users-list/RiskLevelFilterButton';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import { denseArray } from '@/utils/lang';
import {
  Account,
  ChecklistStatus,
  DerivedStatus,
  PaymentMethod,
  SLAPolicy,
  SLAPolicyStatus,
} from '@/apis';
import { isValidTableListViewEnum } from '@/apis/models-custom/TableListViewEnum';
import { ScopeSelectorValue } from '@/pages/case-management/components/ScopeSelector';
import { CASE_TYPES } from '@/apis/models-custom/CaseType';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useBusinessIndustries, useRuleQueues } from '@/hooks/api';
import { RULE_NATURES } from '@/apis/models-custom/RuleNature';
import { useDerivedStatusesFromPermissions } from '@/utils/permissions/case-permission-filter';
import { useDerivedAlertStatusesFromPermissions } from '@/utils/permissions/alert-permission-filter';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import { useRoles } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { isPaymentMethod } from '@/utils/payments';
import { TransactionsTableParams } from '@/pages/transactions/components/TransactionsTable';
import { useReasons } from '@/utils/reasons';

export const queryAdapter: Adapter<TableSearchParams> = {
  serializer: (params) => {
    return {
      ...defaultQueryAdapter.serializer(params),
      showCases: params.showCases,
      alertId: params.alertId,
      timestamp: params.timestamp?.map((x) => dayjs(x).valueOf()).join(','),
      createdTimestamp: params.createdTimestamp
        ?.map((x) => (x ? dayjs(x).valueOf() : 'null'))
        .join(','),
      caseId: params.caseId,
      rulesHitFilter: params.rulesHitFilter?.join(','),
      rulesExecutedFilter: params.rulesExecutedFilter?.join(','),
      userId: params.userId,
      userName: params.userName,
      parentUserId: params.parentUserId,
      status: params.status?.join(','),
      originMethodFilter: params.originMethodFilter?.join(','),
      destinationMethodFilter: params.destinationMethodFilter?.join(','),
      transactionState: params.transactionState?.join(','),
      tagKey: params.tagKey ?? undefined,
      tagValue: params.tagValue ?? undefined,
      caseStatus: params.caseStatus === null ? params.caseStatus : params.caseStatus?.join(','),
      alertStatus: params.alertStatus?.join(','),
      filterTypes: params.filterTypes?.join(','),
      businessIndustryFilter: params.businessIndustryFilter?.join(','),
      caseTypesFilter: params.caseTypesFilter?.join(','),
      userStates: params.userStates?.join(','),
      riskLevels: params.riskLevels?.join(','),
      assignedTo: params.assignedTo?.join(','),
      roleAssignedTo: params.roleAssignedTo?.join(','),
      qaAssignment: params.qaAssignment?.join(','),
      updatedAt: params['updatedAt']?.map((x) => dayjs(x).valueOf()).join(','),
      filterQaStatus: params['filterQaStatus'],
      filterClosingReason: params['filterClosingReason']?.join(','),
      alertPriority: params.alertPriority?.join(','),
      ruleQueueIds: params.ruleQueueIds?.join(','),
      ruleNature: params.ruleNature?.join(','),
      forensicsFor: JSON.stringify(params.forensicsFor),
      filterCaseSlaPolicyId: params.filterCaseSlaPolicyId?.join(','),
      filterCaseSlaPolicyStatus: params.filterCaseSlaPolicyStatus?.join(','),
      filterAlertSlaPolicyId: params.filterAlertSlaPolicyId?.join(','),
      filterAlertSlaPolicyStatus: params.filterAlertSlaPolicyStatus?.join(','),
      ...(params.paymentApprovals
        ? mapKeys(
            paymentApprovalQueryAdapter.serializer(params.paymentApprovals),
            (value, key) => PAYMENT_APPROVAL_KEY_PREFIX + key,
          )
        : {}),
    };
  },
  deserializer: (raw): TableSearchParams => {
    const showCases = raw.showCases;
    return {
      ...defaultQueryAdapter.deserializer(raw),
      paymentApprovals: paymentApprovalQueryAdapter.deserializer(
        mapKeys(
          pickBy(raw, (value, key) => key.startsWith(PAYMENT_APPROVAL_KEY_PREFIX)),
          (value, key) => key?.substring(PAYMENT_APPROVAL_KEY_PREFIX.length),
        ),
      ),
      timestamp: raw.timestamp
        ? raw.timestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : undefined,
      createdTimestamp: raw.createdTimestamp
        ? raw.createdTimestamp
            .split(',')
            .map((x) => (x === 'null' ? undefined : dayjs(parseInt(x)).format()))
        : undefined,
      caseId: raw.caseId,
      alertId: raw.alertId,
      rulesHitFilter: raw.rulesHitFilter?.split(','),
      rulesExecutedFilter: raw.rulesExecutedFilter?.split(','),
      userId: raw.userId,
      userName: raw.userName,
      parentUserId: raw.parentUserId,
      status: raw.status ? raw.status.split(',').filter(isRuleAction) : undefined,
      originMethodFilter: raw.originMethodFilter?.split(',') as PaymentMethod[],
      destinationMethodFilter: raw.destinationMethodFilter?.split(',') as PaymentMethod[],
      transactionState:
        raw.transactionState != null
          ? raw.transactionState.split(',').filter(isTransactionState)
          : undefined,
      tagKey: raw.tagKey ?? undefined,
      tagValue: raw.tagValue ?? undefined,
      caseStatus:
        raw.caseStatus === null ? raw.caseStatus : (raw.caseStatus?.split(',') as DerivedStatus[]),
      alertStatus: raw.alertStatus?.split(',') as DerivedStatus[],
      filterTypes: raw.filterTypes?.split(',') as unknown as TableSearchParams['filterTypes'],
      businessIndustryFilter: raw.businessIndustryFilter?.split(','),
      caseTypesFilter: raw.caseTypesFilter?.split(
        ',',
      ) as unknown as TableSearchParams['caseTypesFilter'],
      userStates: raw.userStates?.split(',') as unknown as TableSearchParams['userStates'],
      riskLevels: raw.riskLevels?.split(',') as unknown as TableSearchParams['riskLevels'],
      showCases: (showCases as ScopeSelectorValue | undefined) ?? 'ALL',
      assignedTo: raw.assignedTo?.split(',') as unknown as TableSearchParams['assignedTo'],
      roleAssignedTo: raw.roleAssignedTo?.split(
        ',',
      ) as unknown as TableSearchParams['roleAssignedTo'],
      qaAssignment: raw.qaAssignment?.split(',') as unknown as TableSearchParams['qaAssignment'],
      updatedAt: raw?.['updatedAt']?.split(',').map((x) => dayjs(parseInt(x)).format()),
      filterQaStatus: raw?.['filterQaStatus'] as ChecklistStatus | undefined | "NOT_QA'd",
      filterClosingReason: raw?.['filterClosingReason']?.split(',') as string[],
      alertPriority: raw?.alertPriority?.split(
        ',',
      ) as unknown as TableSearchParams['alertPriority'],
      ruleQueueIds: raw.ruleQueueIds?.split(','),
      ruleNature: raw.ruleNature?.split(','),
      forensicsFor: raw.forensicsFor ? JSON.parse(raw.forensicsFor) : undefined,
      filterCaseSlaPolicyId: raw.filterCaseSlaPolicyId?.split(',') ?? undefined,
      filterCaseSlaPolicyStatus: raw.filterCaseSlaPolicyStatus?.split(',') as
        | SLAPolicyStatus[]
        | undefined,
      filterAlertSlaPolicyId: raw.filterAlertSlaPolicyId?.split(',') ?? undefined,
      filterAlertSlaPolicyStatus: raw.filterAlertSlaPolicyStatus?.split(',') as
        | SLAPolicyStatus[]
        | undefined,
    };
  },
};

const PAYMENT_APPROVAL_KEY_PREFIX = `paymentApproval_`;

export const paymentApprovalQueryAdapter: Adapter<TransactionsTableParams> = {
  serializer: (params) => {
    return {
      current: params.current,
      timestamp: params.timestamp?.map((x) => dayjs(x).valueOf()).join(','),
      transactionId: params.transactionId,
      transactionTypes: params.transactionTypes?.join(','),
      transactionState: params.transactionState?.join(','),
      originCurrenciesFilter: params.originCurrenciesFilter?.join(','),
      destinationCurrenciesFilter: params.destinationCurrenciesFilter?.join(','),
      userId: params.userId,
      userName: params.userName,
      tagKey: params.tagKey,
      tagValue: params.tagValue,
      originMethodFilter: params.originMethodFilter,
      destinationMethodFilter: params.destinationMethodFilter,
      originPaymentMethodId: params.originPaymentMethodId,
      destinationPaymentMethodId: params.destinationPaymentMethodId,
      'originPayment.paymentMethodId': params['originPayment.paymentMethodId'],
      'destinationPayment.paymentMethodId': params['destinationPayment.paymentMethodId'],
      transactionStatusFilter: params.transactionStatusFilter?.join(','),
      ruleInstancesHitFilter: params.ruleInstancesHitFilter?.join(','),
      productType: params.productType?.join(','),
      'originAmountDetails.country': params['originAmountDetails.country']?.join(','),
      'destinationAmountDetails.country': params['destinationAmountDetails.country']?.join(','),
      'originPayment.country': params['originPayment.country']?.join(','),
      'destinationPayment.country': params['destinationPayment.country']?.join(','),
      status: params.status,
      direction: params.direction,
      showDetailedView: params.showDetailedView?.toString(),
      view: params.view,
    };
  },
  deserializer: (raw) => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      current: raw.current,
      timestamp: raw.timestamp
        ? raw.timestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : undefined,
      transactionId: raw.transactionId,
      transactionTypes: raw.transactionTypes?.split(','),
      transactionState: raw.transactionState?.split(',').filter(isTransactionState),
      originCurrenciesFilter: raw.originCurrenciesFilter?.split(','),
      destinationCurrenciesFilter: raw.destinationCurrenciesFilter?.split(','),
      userId: raw.userId,
      userName: raw.userName,
      tagKey: raw.tagKey,
      tagValue: raw.tagValue,
      originMethodFilter: isPaymentMethod(raw.originMethodFilter)
        ? raw.originMethodFilter
        : undefined,
      destinationMethodFilter: isPaymentMethod(raw.destinationMethodFilter)
        ? raw.destinationMethodFilter
        : undefined,
      originPaymentMethodId: raw.originPaymentMethodId,
      destinationPaymentMethodId: raw.destinationPaymentMethodId,
      'originPayment.paymentMethodId': raw['originPayment.paymentMethodId'],
      'destinationPayment.paymentMethodId': raw['destinationPayment.paymentMethodId'],
      transactionStatusFilter: raw.transactionStatusFilter?.split(',').filter(isRuleAction),
      ruleInstancesHitFilter: raw.ruleInstancesHitFilter?.split(','),
      productType: raw.productType?.split(','),
      'originAmountDetails.country': raw['originAmountDetails.country']?.split(','),
      'destinationAmountDetails.country': raw['destinationAmountDetails.country']?.split(','),
      'originPayment.country': raw['originPayment.country']?.split(','),
      'destinationPayment.country': raw['destinationPayment.country']?.split(','),
      status: isRuleAction(raw.status) ? raw.status : undefined,
      direction: raw.direction as 'incoming' | 'outgoing' | 'all' | undefined,
      showDetailedView: raw.showDetailedView ? raw.showDetailedView === 'true' : undefined,
      view: isValidTableListViewEnum(raw.view) ? raw.view : undefined,
    };
  },
};

export const useCaseAlertFilters = (
  filterIds?: string[],
): ExtraFilterProps<TableSearchParams>[] => {
  const settings = useSettings();
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const isAlertSlaEnabled = useFeatureEnabled('ALERT_SLA');
  const isCaseSlaEnabled = useFeatureEnabled('PNB');
  const ruleOptions = useRuleOptions({ onlyWithAlerts: true });
  const ruleQueues = useRuleQueues();
  const businessIndustries = useBusinessIndustries();
  const allowedCaseStatuses = useDerivedStatusesFromPermissions();
  const allowedAlertStatuses = useDerivedAlertStatusesFromPermissions();

  const [roles] = useRoles();
  const roleAssignedToOptions = map(roles, 'name');
  roleAssignedToOptions.unshift('Unassigned');

  const closureReasons = useReasons('CLOSURE');

  return denseArray([
    {
      title: 'Case ID',
      key: 'caseId',
      renderer: { kind: 'string' },
      showFilterByDefault: true,
      icon: <StackLineIcon />,
    },
    {
      title: 'Alert priority',
      key: 'alertPriority',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'select',
        options: PRIORITYS.map((x) => ({ value: x, label: x })),
      },
      showFilterByDefault: true,
    },
    {
      title: 'Case type',
      key: 'caseTypesFilter',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: CASE_TYPES.map((x) => ({ value: x, label: humanizeConstant(x) })),
      },
      showFilterByDefault: true,
    },
    {
      title: 'Rules',
      key: 'rulesHitFilter',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'select',
        options: ruleOptions,
      },
      icon: <GavelIcon />,
      showFilterByDefault: true,
    },
    {
      key: 'userId',
      title: `${firstLetterUpper(settings.userAlias)} ID`,
      showFilterByDefault: true,
      renderer: ({ params, setParams }) => (
        <UserSearchButton
          title={`${firstLetterUpper(settings.userAlias)} ID`}
          userId={params.userId ?? null}
          params={params}
          onConfirm={setParams}
          filterType="id"
        />
      ),
    },
    {
      key: 'userName',
      title: `${firstLetterUpper(settings.userAlias)} name`,
      showFilterByDefault: true,
      renderer: ({ params, setParams }) => (
        <UserSearchButton
          title={`${firstLetterUpper(settings.userAlias)} name`}
          userId={params.userId ?? null}
          params={params}
          onConfirm={setParams}
          filterType="name"
        />
      ),
    },
    {
      key: 'parentUserId',
      title: `Parent ${settings.userAlias} ID/Name`,
      showFilterByDefault: false,
      renderer: ({ params, setParams }) => (
        <UserSearchButton
          title={`Parent ${settings.userAlias} ID/Name`}
          userId={params.parentUserId ?? null}
          params={params}
          onConfirm={setParams}
        />
      ),
    },
    {
      key: 'tagKey',
      title: 'Tags',
      renderer: ({ params, setParams }) => (
        <TransactionTagSearchButton
          initialState={{
            key: params.tagKey ?? null,
            value: params.tagValue ?? null,
          }}
          onConfirm={(value) => {
            setParams((state) => ({
              ...state,
              tagKey: value.key ?? undefined,
              tagValue: value.value ?? undefined,
            }));
          }}
        />
      ),
    },
    {
      key: 'businessIndustryFilter',
      title: 'Business industry',
      showFilterByDefault: true,
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: businessIndustries.map((x) => ({ value: x, label: x })),
      },
    },
    {
      key: 'assignedTo',
      title: 'Assigned to',
      showFilterByDefault: false,
      renderer: ({ params, setParams, onUpdateFilterClose }) => (
        <AccountsFilter
          includeUnassigned={true}
          title="Assigned to"
          Icon={<UserOutlined />}
          users={params.assignedTo ?? []}
          onConfirm={(value) => {
            setParams((state) => ({
              ...state,
              assignedTo: value ?? undefined,
            }));
          }}
          onUpdateFilterClose={onUpdateFilterClose}
        />
      ),
    },
    {
      key: 'roleAssignedTo',
      title: 'Assignee role',
      showFilterByDefault: false,
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: roleAssignedToOptions.map((x) => ({ value: x, label: humanizeConstant(x) })),
      },
    },
    {
      key: 'originMethodFilterId',
      title: 'Origin method',
      showFilterByDefault: false,
      renderer: ({ params, setParams }) => (
        <PaymentMethodButton
          direction={'ORIGIN'}
          methods={params.originMethodFilter ?? []}
          onConfirm={(value) => {
            setParams((state) => ({
              ...state,
              originMethodFilter: (value as PaymentMethod[]) ?? undefined,
            }));
          }}
        />
      ),
    },
    {
      key: 'destinationMethodFilterId',
      title: 'Destination method',
      showFilterByDefault: false,
      renderer: ({ params, setParams }) => (
        <PaymentMethodButton
          direction={'DESTINATION'}
          methods={params.destinationMethodFilter ?? []}
          onConfirm={(value) => {
            setParams((state) => ({
              ...state,
              destinationMethodFilter: (value as PaymentMethod[]) ?? undefined,
            }));
          }}
        />
      ),
    },
    isRiskLevelsEnabled && {
      key: 'riskLevels',
      title: 'CRA',
      renderer: ({ params, setParams, onUpdateFilterClose }) => (
        <RiskLevelButton
          riskLevels={params.riskLevels ?? []}
          onConfirm={(value) => {
            setParams((state) => ({
              ...state,
              riskLevels: value ?? undefined,
            }));
          }}
          onUpdateFilterClose={onUpdateFilterClose}
        />
      ),
    },
    {
      title: 'Queue',
      key: 'ruleQueueIds',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: [{ value: 'default', label: 'default' }].concat(
          ruleQueues.map((v) => ({ value: v.id ?? v.name, label: v.name })),
        ),
      },
      showFilterByDefault: true,
    },
    {
      title: 'Rule nature',
      key: 'ruleNature',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: RULE_NATURES.map((x) => ({ value: x, label: humanizeConstant(x) })),
      },
      showFilterByDefault: true,
    },
    {
      title: 'Case status',
      key: 'caseStatus',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: allowedCaseStatuses.map((status) => ({
          value: status,
          label: <CaseStatusTag caseStatus={status} />,
          labelText: humanizeSnakeCase(status),
        })),
      },
      showFilterByDefault: true,
      pinFilterToLeft: true,
    },
    {
      title: 'Alert status',
      key: 'alertStatus',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: allowedAlertStatuses.map((status) => ({
          value: status,
          label: <CaseStatusTag caseStatus={status} />,
          labelText: humanizeSnakeCase(status),
        })),
      },
      showFilterByDefault: true,
      pinFilterToLeft: true,
    },
    {
      title: 'Reason',
      key: 'filterClosingReason',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: closureReasons.map((reason) => ({ value: reason, label: reason })),
      },
      showFilterByDefault: true,
    },
    isAlertSlaEnabled && {
      title: 'SLA status',
      key: 'alertSla',
      renderer: ({ params, setParams }) => (
        <SlaFilter
          slaPolicyId={params.filterAlertSlaPolicyId ?? undefined}
          slaPolicyStatus={params.filterAlertSlaPolicyStatus ?? undefined}
          onConfirm={(slaPolicyId, slaPolicyStatus) => {
            setParams((state) => ({
              ...state,
              filterAlertSlaPolicyId: slaPolicyId ?? undefined,
              filterAlertSlaPolicyStatus: slaPolicyStatus ?? undefined,
            }));
          }}
        />
      ),
    },
    isCaseSlaEnabled && {
      title: 'SLA status',
      key: 'caseSla',
      renderer: ({ params, setParams }) => (
        <SlaFilter
          slaPolicyId={params.filterCaseSlaPolicyId ?? undefined}
          slaPolicyStatus={params.filterCaseSlaPolicyStatus ?? undefined}
          onConfirm={(slaPolicyId, slaPolicyStatus) => {
            setParams((state) => ({
              ...state,
              filterCaseSlaPolicyId: slaPolicyId ?? undefined,
              filterCaseSlaPolicyStatus: slaPolicyStatus ?? undefined,
            }));
          }}
        />
      ),
    },
  ]).filter((filter) => filterIds?.includes(filter.key)) as ExtraFilterProps<TableSearchParams>[];
};

export const getSlaColumnsForExport = <T extends ColumnHelper<any>>(
  helper: T,
  slaPolicies: SLAPolicy[],
  accounts: Account[],
) => {
  const columns = range(0, MAX_SLA_POLICIES_PER_ENTITY).flatMap((i) => [
    helper.simple<'slaPolicyDetails'>({
      title: `SLA policy ${i + 1} - Name`,
      key: `slaPolicyDetails`,
      type: {
        stringify: (slaPolicyDetails) => {
          const policyDetail = slaPolicyDetails?.[i];
          const policyId = policyDetail?.slaPolicyId;
          const policy = slaPolicies.find((policy) => policy.id === policyId);
          return policy?.name ?? '-';
        },
      },
      hideInTable: true,
      exporting: true,
    }),
    helper.simple<'slaPolicyDetails'>({
      title: `SLA policy ${i + 1} - Status`,
      key: `slaPolicyDetails`,
      type: {
        stringify: (slaPolicyDetails) => {
          return slaPolicyDetails?.[i]?.policyStatus ?? '-';
        },
      },
      hideInTable: true,
      exporting: true,
    }),
    helper.simple<'slaPolicyDetails'>({
      title: `SLA policy ${i + 1} - Exceeded by/Exceeding in`,
      key: `slaPolicyDetails`,
      type: {
        stringify: (slaPolicyDetails) => {
          const policyDetail = slaPolicyDetails?.[i];
          if (!policyDetail) {
            return '-';
          }

          const { policyStatus, slaPolicyId } = policyDetail;
          const policy = slaPolicies.find((policy) => policy.id === slaPolicyId);

          const timeDescription = policyStatus === 'BREACHED' ? 'Exceeded by ' : 'Exceeding in ';

          return policy
            ? `${timeDescription}${getPolicyTime(policy, policyDetail, accounts)}`
            : '-';
        },
      },
      hideInTable: true,
      exporting: true,
    }),
  ]);
  return columns;
};
