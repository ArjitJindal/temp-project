import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import CaseTableWrapper from './CaseTableWrapper';
import AlertTable from './AlertTable';
import s from './index.module.less';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';
import { TableSearchParams } from '@/pages/case-management/types';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { queryAdapter } from '@/pages/case-management/helpers';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useDeepEqualEffect } from '@/utils/hooks';
import ScopeSelector, {
  ScopeSelectorValue,
} from '@/pages/case-management/components/ScopeSelector';
import StatusButtons from '@/pages/case-management/components/StatusButtons';
import PaymentApprovalsTable from '@/pages/case-management/PaymentApprovalTable';
import Toggle from '@/components/library/Toggle';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Item } from '@/components/library/SegmentedControl';
import QaTable from '@/pages/case-management/QaTable';
import { useQaMode } from '@/utils/qa-mode';
import Tooltip from '@/components/library/Tooltip';
import { getBranding } from '@/utils/branding';
import { Authorized } from '@/components/Authorized';
import { DerivedStatus } from '@/apis';

export default function CaseManagementPage() {
  const i18n = useI18n();
  useCloseSidebarByDefault();
  const [qaMode, setQaMode] = useQaMode();
  const hasQaEnabled = useFeatureEnabled('QA');
  const navigate = useNavigate();
  const parsedParams = queryAdapter.deserializer({
    showCases: qaMode ? 'QA_UNCHECKED_ALERTS' : 'ALL',
    ...parseQueryString(location.search),
  });
  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    ...parsedParams,
    caseStatus: null,
    alertStatus: null,
  });

  useEffect(() => {
    if (qaMode) {
      setParams((params) => ({ ...params, showCases: 'QA_UNCHECKED_ALERTS' }));
    } else {
      setParams((params) => ({ ...params, showCases: 'ALL' }));
    }
  }, [qaMode]);

  useEffect(() => {
    setParams((params) => ({ ...params, alertStatus: null, caseStatus: null }));
  }, [parsedParams.showCases]);

  const pushParamsToNavigation = useCallback(
    (params: TableSearchParams) => {
      if (params.showCases === 'ALL' || params.showCases === 'MY') {
        params.alertStatus = null;
      } else {
        params.caseStatus = null;
      }

      if (params.showCases === 'MY_ALERTS' || params.showCases === 'MY') {
        params.assignedTo = undefined;
      }
      navigate(makeUrl('/case-management/cases', {}, queryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate],
  );

  const handleChangeParams = (newParams: AllParams<TableSearchParams>) => {
    pushParamsToNavigation(newParams);
  };

  const getDefaultStatus = (_param?: string): DerivedStatus[] | undefined => {
    return ['OPEN'];
  };

  const settings = useSettings();
  useDeepEqualEffect(() => {
    setParams((prevState: AllParams<TableSearchParams>) => ({
      ...prevState,
      ...parsedParams,
      caseStatus:
        prevState.caseStatus === null && !parsedParams.caseStatus
          ? getDefaultStatus(parsedParams.showCases)
          : parsedParams.caseStatus,
      alertStatus:
        prevState.alertStatus === null && !parsedParams.alertStatus
          ? getDefaultStatus(parsedParams.showCases)
          : parsedParams.alertStatus,
      page: parsedParams.page ?? 1,
      sort: parsedParams.sort ?? [],
      pageSize: parsedParams.pageSize ?? DEFAULT_PAGE_SIZE,
    }));
  }, [parsedParams]);

  const normalModeItems: Item<ScopeSelectorValue>[] = [
    { value: 'ALL', label: 'All cases' },
    { value: 'MY', label: 'My cases' },
    { value: 'ALL_ALERTS', label: 'All alerts' },
    { value: 'MY_ALERTS', label: 'My alerts' },
  ];

  if (settings.isPaymentApprovalEnabled) {
    normalModeItems.push({ value: 'PAYMENT_APPROVALS', label: 'Payment approval' });
  }

  const qaModeItems: Item<ScopeSelectorValue>[] = [
    { value: 'QA_UNCHECKED_ALERTS', label: "Closed & Not QA'd alerts" },
    { value: 'QA_PASSED_ALERTS', label: 'Passed alerts' },
    { value: 'QA_FAILED_ALERTS', label: 'Failed alerts' },
  ];

  const branding = getBranding();

  return (
    <PageWrapper
      title={i18n('menu.case-management')}
      actionButton={
        <div className={s.qaSwitch}>
          {hasQaEnabled ? (
            <Toggle
              value={qaMode}
              onChange={(value) => setQaMode(!!value)}
              disabled={false}
              showLabel
              label={'QA'}
            />
          ) : (
            <Tooltip
              title={`This is an advanced feature. Contact support at ${branding.supportEmail} to access it.`}
              placement="topLeft"
            >
              <div>
                <Toggle value={qaMode} disabled={true} />
              </div>
            </Tooltip>
          )}
        </div>
      }
    >
      <PageWrapperContentContainer>
        <div className={s.header}>
          <ScopeSelector<TableSearchParams>
            params={params}
            onChangeParams={(cb) => {
              handleChangeParams(cb(params));
            }}
            values={!qaMode ? normalModeItems : qaModeItems}
          />
          {!qaMode && params.showCases === 'PAYMENT_APPROVALS' && (
            <StatusButtons params={params} onChangeParams={handleChangeParams} />
          )}
        </div>
        {getTable(params, handleChangeParams)}
      </PageWrapperContentContainer>
    </PageWrapper>
  );
}

function getTable(
  params: AllParams<TableSearchParams>,
  handleChangeParams: (newParams: AllParams<TableSearchParams>) => void,
) {
  switch (params.showCases) {
    case 'MY_ALERTS':
      return (
        <Authorized required={['case-management:case-overview:read']} showForbiddenPage>
          <AlertTable
            hideAlertStatusFilters={true}
            escalatedTransactionIds={[]}
            params={params}
            onChangeParams={handleChangeParams}
            showAssignedToFilter={false}
            showUserFilters
          />
        </Authorized>
      );
    case 'ALL_ALERTS':
      return (
        <Authorized required={['case-management:case-overview:read']} showForbiddenPage>
          <AlertTable
            hideAlertStatusFilters={true}
            escalatedTransactionIds={[]}
            params={params}
            onChangeParams={handleChangeParams}
            showUserFilters
            showAssignedToFilter
          />
        </Authorized>
      );
    case 'MY':
    case 'ALL':
      return (
        <Authorized required={['case-management:case-overview:read']} showForbiddenPage>
          <CaseTableWrapper params={params} onChangeParams={handleChangeParams} />
        </Authorized>
      );
    case 'PAYMENT_APPROVALS':
      return (
        <Authorized required={['transactions:details:read']} showForbiddenPage>
          <PaymentApprovalsTable filterStatus={params.status} />
        </Authorized>
      );
    case 'QA_UNCHECKED_ALERTS':
      return (
        <Authorized required={['case-management:qa:read']} showForbiddenPage>
          <QaTable
            params={{ ...params, alertStatus: ['CLOSED'], filterQaStatus: ["NOT_QA'd"] }}
            onChangeParams={handleChangeParams}
          />
        </Authorized>
      );
    case 'QA_PASSED_ALERTS':
      return (
        <Authorized required={['case-management:qa:read']} showForbiddenPage>
          <QaTable
            params={{ ...params, filterQaStatus: ['PASSED'], alertStatus: ['CLOSED'] }}
            onChangeParams={handleChangeParams}
          />
        </Authorized>
      );
    case 'QA_FAILED_ALERTS':
      return (
        <Authorized required={['case-management:qa:read']} showForbiddenPage>
          <QaTable
            params={{ ...params, filterQaStatus: ['FAILED'], alertStatus: ['CLOSED'] }}
            onChangeParams={handleChangeParams}
          />
        </Authorized>
      );
  }
}
