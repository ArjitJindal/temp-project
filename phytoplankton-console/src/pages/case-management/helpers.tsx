import React from 'react';
import PaymentMethodButton from '../transactions/components/PaymentMethodButton';
import { AssignmentButton } from './components/AssignmentButton';
import GavelIcon from './gavel.react.svg';
import { dayjs } from '@/utils/dayjs';
import '../../components/ui/colors';
import { Adapter } from '@/utils/routing';
import { isRuleAction, isTransactionState, useRuleOptions } from '@/utils/rules';
import { TableSearchParams } from '@/pages/case-management/types';
import { isMode } from '@/pages/transactions/components/UserSearchPopup/types';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import { ExtraFilter } from '@/components/library/Table/types';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import BusinessIndustryButton from '@/pages/transactions/components/BusinessIndustryButton';
import { RiskLevelButton } from '@/pages/users/users-list/RiskLevelFilterButton';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import { denseArray } from '@/utils/lang';
import { AlertStatus, CaseReasons, CaseStatus, ChecklistStatus, PaymentMethod } from '@/apis';
import { ScopeSelectorValue } from '@/pages/case-management/components/ScopeSelector';
import { CASE_TYPES } from '@/apis/models-custom/CaseType';
import { humanizeConstant } from '@/utils/humanize';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useRuleQueues } from '@/components/rules/util';
import { RULE_NATURES } from '@/apis/models-custom/RuleNature';

export const queryAdapter: Adapter<TableSearchParams> = {
  serializer: (params) => {
    return {
      ...defaultQueryAdapter.serializer(params),
      showCases: params.showCases,
      alertId: params.alertId,
      timestamp: params.timestamp?.map((x) => dayjs(x).valueOf()).join(','),
      createdTimestamp: params.createdTimestamp?.map((x) => dayjs(x).valueOf()).join(','),
      transactionTimestamp: params.transactionTimestamp?.map((x) => dayjs(x).valueOf()).join(','),
      caseId: params.caseId,
      rulesHitFilter: params.rulesHitFilter?.join(','),
      rulesExecutedFilter: params.rulesExecutedFilter?.join(','),
      originCurrenciesFilter: params.originCurrenciesFilter?.join(','),
      destinationCurrenciesFilter: params.destinationCurrenciesFilter?.join(','),
      userId: params.userId,
      userFilterMode: params.userFilterMode,
      type: params.type,
      status: params.status?.join(','),
      originMethodFilter: params.originMethodFilter?.join(','),
      destinationMethodFilter: params.destinationMethodFilter?.join(','),
      transactionState: params.transactionState?.join(','),
      tagKey: params.tagKey ?? undefined,
      tagValue: params.tagValue ?? undefined,
      caseStatus: params.caseStatus,
      alertStatus: params.alertStatus,
      transactionId: params.transactionId,
      amountGreaterThanFilter: params.amountGreaterThanFilter,
      amountLessThanFilter: params.amountLessThanFilter,
      originCountryFilter: params.originCountryFilter,
      destinationCountryFilter: params.destinationCountryFilter,
      filterTypes: params.filterTypes?.join(','),
      businessIndustryFilter: params.businessIndustryFilter?.join(','),
      caseTypesFilter: params.caseTypesFilter?.join(','),
      userStates: params.userStates?.join(','),
      riskLevels: params.riskLevels?.join(','),
      assignedTo: params.assignedTo?.join(','),
      qaAssignment: params.qaAssignment?.join(','),
      updatedAt: params['updatedAt']?.map((x) => dayjs(x).valueOf()).join(','),
      filterQaStatus: params['filterQaStatus']?.join(','),
      filterClosingReason: params['filterClosingReason']?.join(','),
      alertPriority: params.alertPriority?.join(','),
      ruleQueueIds: params.ruleQueueIds?.join(','),
      ruleNature: params.ruleNature?.join(','),
    };
  },
  deserializer: (raw): TableSearchParams => {
    const showCases = raw.showCases;
    return {
      ...defaultQueryAdapter.deserializer(raw),
      timestamp: raw.timestamp
        ? raw.timestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : undefined,
      createdTimestamp: raw.createdTimestamp
        ? raw.createdTimestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : undefined,
      transactionTimestamp: raw.transactionTimestamp
        ? raw.transactionTimestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : undefined,
      caseId: raw.caseId,
      alertId: raw.alertId,
      rulesHitFilter: raw.rulesHitFilter?.split(','),
      rulesExecutedFilter: raw.rulesExecutedFilter?.split(','),
      originCurrenciesFilter: raw.originCurrenciesFilter?.split(','),
      destinationCurrenciesFilter: raw.destinationCurrenciesFilter?.split(','),
      userId: raw.userId,
      userFilterMode: isMode(raw.userFilterMode) ? raw.userFilterMode : undefined,
      type: raw.type,
      status: raw.status ? raw.status.split(',').filter(isRuleAction) : undefined,
      originMethodFilter: raw.originMethodFilter?.split(',') as PaymentMethod[],
      destinationMethodFilter: raw.destinationMethodFilter?.split(',') as PaymentMethod[],
      transactionState:
        raw.transactionState != null
          ? raw.transactionState.split(',').filter(isTransactionState)
          : undefined,
      tagKey: raw.tagKey ?? undefined,
      tagValue: raw.tagValue ?? undefined,
      caseStatus: (raw.caseStatus ?? 'OPEN') as CaseStatus,
      alertStatus: (raw.alertStatus ?? 'OPEN') as AlertStatus,
      transactionId: raw.transactionId,
      amountGreaterThanFilter: raw.amountGreaterThanFilter
        ? parseInt(raw.amountGreaterThanFilter)
        : undefined,
      amountLessThanFilter: raw.amountLessThanFilter
        ? parseInt(raw.amountLessThanFilter)
        : undefined,
      originCountryFilter: raw.originCountryFilter,
      destinationCountryFilter: raw.destinationCountryFilter,
      filterTypes: raw.filterTypes?.split(',') as unknown as TableSearchParams['filterTypes'],
      businessIndustryFilter: raw.businessIndustryFilter?.split(','),
      caseTypesFilter: raw.caseTypesFilter?.split(
        ',',
      ) as unknown as TableSearchParams['caseTypesFilter'],
      userStates: raw.userStates?.split(',') as unknown as TableSearchParams['userStates'],
      riskLevels: raw.riskLevels?.split(',') as unknown as TableSearchParams['riskLevels'],
      showCases: (showCases as ScopeSelectorValue | undefined) ?? 'ALL',
      assignedTo: raw.assignedTo?.split(',') as unknown as TableSearchParams['assignedTo'],
      qaAssignment: raw.qaAssignment?.split(',') as unknown as TableSearchParams['qaAssignment'],
      updatedAt: raw?.['updatedAt']?.split(',').map((x) => dayjs(parseInt(x)).format()),
      filterQaStatus: raw?.['filterQaStatus']?.split(',') as ChecklistStatus[] | undefined,
      filterClosingReason: raw?.['filterClosingReason']?.split(',') as CaseReasons[],
      alertPriority: raw?.alertPriority?.split(
        ',',
      ) as unknown as TableSearchParams['alertPriority'],
      ruleQueueIds: raw.ruleQueueIds?.split(','),
      ruleNature: raw.ruleNature?.split(','),
    };
  },
};

export const useCaseAlertFilters = (filterIds?: string[]): ExtraFilter<TableSearchParams>[] => {
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const ruleOptions = useRuleOptions();
  const ruleQueues = useRuleQueues();
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
      title: 'User ID/Name',
      showFilterByDefault: true,
      renderer: ({ params, setParams }) => (
        <UserSearchButton
          initialMode={params.userFilterMode ?? 'ALL'}
          userId={params.userId ?? null}
          onConfirm={(userId, mode) => {
            setParams((state) => ({
              ...state,
              userId: userId ?? undefined,
              userFilterMode: mode ?? 'ALL',
            }));
          }}
        />
      ),
    },
    {
      key: 'tagKey',
      title: 'Tags',
      renderer: ({ params, setParams }) => (
        <TagSearchButton
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
      renderer: ({ params, setParams, onUpdateFilterClose }) => (
        <BusinessIndustryButton
          businessIndustry={params.businessIndustryFilter ?? []}
          onConfirm={(value) => {
            setParams((state) => ({
              ...state,
              businessIndustryFilter: value ?? undefined,
            }));
          }}
          onUpdateFilterClose={onUpdateFilterClose}
        />
      ),
    },
    {
      key: 'assignedTo',
      title: 'Assigned to',
      showFilterByDefault: false,
      renderer: ({ params, setParams, onUpdateFilterClose }) => (
        <AssignmentButton
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
      key: 'originMethodFilterId',
      title: 'Origin Method',
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
      title: 'Destination Method',
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
          ruleQueues.map((v) => ({ value: v.id!, label: v.name })),
        ),
      },
      showFilterByDefault: true,
    },
    {
      title: 'Rule Nature',
      key: 'ruleNature',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: RULE_NATURES.map((x) => ({ value: x, label: x })),
      },
      showFilterByDefault: true,
    },
  ]).filter((filter) => filterIds?.includes(filter.key)) as ExtraFilter<TableSearchParams>[];
};
