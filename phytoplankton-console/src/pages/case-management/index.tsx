import React, { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useLocalStorageState } from 'ahooks';
import CaseTableWrapper from './CaseTableWrapper';
import AlertTable from './AlertTable';
import s from './index.module.less';
import { QAButton } from './QA/Dropdown';
import { Authorized } from '@/components/utils/Authorized';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';
import { TableSearchParams } from '@/pages/case-management/types';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { queryAdapter } from '@/pages/case-management/helpers';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useDeepEqualMemo, useIsChanged } from '@/utils/hooks';
import ScopeSelector, {
  ScopeSelectorValue,
} from '@/pages/case-management/components/ScopeSelector';
import StatusButtons from '@/pages/case-management/components/StatusButtons';
import PaymentApprovalsTable from '@/pages/case-management/PaymentApprovalTable';
import Toggle from '@/components/library/Toggle';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Item } from '@/components/library/SegmentedControl';
import QaTable from '@/pages/case-management/QA/Table';
import { useQaMode } from '@/utils/qa-mode';
import Tooltip from '@/components/library/Tooltip';
import { getBranding } from '@/utils/branding';
import { DerivedStatus } from '@/apis';

type NavigationState = {
  isInitialised: boolean;
} | null;

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
  const [savedParams, setSavedParams] =
    useLocalStorageState<AllParams<TableSearchParams>>('CASE_MANAGEMENT_FILTERS');

  const params = useDeepEqualMemo(() => {
    return {
      ...DEFAULT_PARAMS_STATE,
      ...parsedParams,
      caseStatus: !parsedParams.caseStatus
        ? getDefaultStatus(parsedParams.showCases)
        : parsedParams.caseStatus,
      alertStatus: !parsedParams.alertStatus
        ? getDefaultStatus(parsedParams.showCases)
        : parsedParams.alertStatus,
    };
  }, [qaMode, parsedParams, savedParams]);

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
      const navigationState: NavigationState = {
        isInitialised: true,
      };
      navigate(makeUrl('/case-management/cases', {}, queryAdapter.serializer(params)), {
        replace: true,
        state: navigationState,
      });
    },
    [navigate],
  );

  const handleChangeParams = useCallback(
    (newParams: AllParams<TableSearchParams>) => {
      pushParamsToNavigation(newParams);
      setSavedParams(newParams);
    },
    [pushParamsToNavigation, setSavedParams],
  );

  const locationState = useLocation();
  const isInitialised = (locationState.state as NavigationState)?.isInitialised || false;
  const isQaChanged = useIsChanged(qaMode);
  useEffect(() => {
    if (!isInitialised && savedParams != null) {
      pushParamsToNavigation(savedParams);
    } else if (isQaChanged) {
      handleChangeParams({
        ...params,
        showCases: qaMode ? 'QA_UNCHECKED_ALERTS' : 'ALL',
      });
    }
  }, [
    params,
    qaMode,
    isQaChanged,
    savedParams,
    isInitialised,
    handleChangeParams,
    pushParamsToNavigation,
  ]);

  const settings = useSettings();

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
    { value: 'QA_UNCHECKED_ALERTS', label: "Not QA'd" },
    { value: 'QA_PASSED_ALERTS', label: 'QA passed' },
    { value: 'QA_FAILED_ALERTS', label: 'QA failed' },
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
              testId="qa-toggle"
            />
          ) : (
            <Tooltip
              title={`This is an advanced feature. Contact support at ${branding.supportEmail} to access it.`}
              placement="topLeft"
            >
              <div>
                <Toggle value={qaMode} disabled={true} showLabel label={'QA'} />
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
          {qaMode && params.showCases === 'QA_UNCHECKED_ALERTS' && <QAButton params={params} />}
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
  if (!params.showCases) {
    return null;
  }
  switch (params.showCases) {
    case 'MY_ALERTS':
      return (
        <Authorized required={['case-management:case-overview:read']} showForbiddenPage>
          <AlertTable
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
            isSelectionEnabled={true}
          />
        </Authorized>
      );
    case 'QA_PASSED_ALERTS':
      return (
        <Authorized required={['case-management:qa:read']} showForbiddenPage>
          <QaTable
            params={{ ...params, filterQaStatus: ['PASSED'], alertStatus: ['CLOSED'] }}
            onChangeParams={handleChangeParams}
            isSelectionEnabled={false}
          />
        </Authorized>
      );
    case 'QA_FAILED_ALERTS':
      return (
        <Authorized required={['case-management:qa:read']} showForbiddenPage>
          <QaTable
            params={{ ...params, filterQaStatus: ['FAILED'], alertStatus: ['CLOSED'] }}
            onChangeParams={handleChangeParams}
            isSelectionEnabled={false}
          />
        </Authorized>
      );
  }
}

/*
  Helpers
 */
const getDefaultStatus = (param?: ScopeSelectorValue): DerivedStatus[] => {
  if (param?.includes('QA')) {
    return ['CLOSED'];
  }

  return ['OPEN'];
};
