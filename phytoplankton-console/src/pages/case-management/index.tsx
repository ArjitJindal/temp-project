import React, { useCallback, useEffect } from 'react';
import CaseTableWrapper from './CaseTableWrapper';
import s from './index.module.less';
import { QAButton } from './QA/Dropdown';
import AlertTableWrapper from './AlertTable/AlertTableWrappper';
import { Authorized } from '@/components/utils/Authorized';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';
import { TableSearchParams } from '@/pages/case-management/types';
import { makeUrl, useNavigationParams } from '@/utils/routing';
import { queryAdapter } from '@/pages/case-management/helpers';
import { AllParams } from '@/components/library/Table/types';
import ScopeSelector, {
  isAlertScope,
  isCasesScope,
  isQaScope,
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
import Label from '@/components/library/Label';
import { applyUpdater, Updater } from '@/utils/state';
import { useIsChanged } from '@/utils/hooks';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useAuth0User, useUsers } from '@/utils/user-utils';

export default function CaseManagementPage() {
  const i18n = useI18n();
  useCloseSidebarByDefault();
  const [qaMode, setQaMode] = useQaMode();
  const hasQaEnabled = useFeatureEnabled('QA');
  const auth0User = useAuth0User();
  const [users] = useUsers();
  const userAccount = users[auth0User.userId];

  const [params, setParams] = useNavigationParams<AllParams<TableSearchParams>>({
    queryAdapter: queryAdapter,
    makeUrl: (rawQueryParams) => makeUrl('/case-management/cases', {}, rawQueryParams),
    persist: {
      id: 'case-management-navigation-params',
    },
  });

  const userEscalationLevel = userAccount?.escalationLevel;

  const handleChangeParams = useCallback(
    (paramsUpdater: Updater<AllParams<TableSearchParams>>) => {
      setParams((prevState) => {
        const newParams = applyUpdater(prevState, paramsUpdater);
        // When changing type of scope - reset status filter
        if (isAlertScope(newParams.showCases) && !isAlertScope(prevState.showCases)) {
          newParams.alertStatus = ['OPEN'];
          newParams.caseStatus = null;
        } else if (isCasesScope(newParams.showCases) && !isCasesScope(prevState.showCases)) {
          newParams.alertStatus = null;
          // if users has escalation level then show relevant escalated cases
          if (userEscalationLevel === 'L1') {
            newParams.caseStatus = ['ESCALATED'];
          } else if (userEscalationLevel === 'L2') {
            newParams.caseStatus = ['ESCALATED_L2'];
          } else {
            newParams.caseStatus = ['OPEN'];
          }
        } else if (isQaScope(newParams.showCases)) {
          newParams.alertStatus = ['CLOSED'];
          newParams.caseStatus = null;
        }
        if (newParams.showCases === 'MY_ALERTS' || newParams.showCases === 'MY') {
          newParams.assignedTo = undefined;
        }
        return newParams;
      });
    },
    [setParams, userEscalationLevel],
  );

  // When changing qa mode - change scope
  const isQaModeChanged = useIsChanged(qaMode);
  useEffect(() => {
    if (isQaModeChanged) {
      handleChangeParams((prevState) => {
        if (qaMode && !isQaScope(prevState.showCases)) {
          return {
            ...prevState,
            showCases: 'QA_UNCHECKED_ALERTS',
          };
        }
        if (!qaMode && isQaScope(prevState.showCases)) {
          return {
            ...prevState,
            showCases: 'ALL',
          };
        }
        return prevState;
      });
    }
  }, [isQaModeChanged, qaMode, handleChangeParams]);

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
            <Label label={'QA'} position={'RIGHT'}>
              <Toggle value={qaMode} onChange={(value) => setQaMode(!!value)} testId="qa-toggle" />
            </Label>
          ) : (
            <Tooltip
              title={`This is an advanced feature. Contact support at ${branding.supportEmail} to access it.`}
              placement="topLeft"
            >
              <div>
                <Label label={'QA'} position={'RIGHT'}>
                  <Toggle value={qaMode} isDisabled={true} />
                </Label>
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
            <StatusButtons
              params={params.paymentApprovals ?? DEFAULT_PARAMS_STATE}
              onChangeParams={(newParams) => {
                handleChangeParams({
                  ...params,
                  paymentApprovals: newParams,
                });
              }}
            />
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
          <AlertTableWrapper
            escalatedTransactionIds={[]}
            params={params}
            onChangeParams={handleChangeParams}
            showUserFilters
          />
        </Authorized>
      );
    case 'ALL_ALERTS':
      return (
        <Authorized required={['case-management:case-overview:read']} showForbiddenPage>
          <AlertTableWrapper
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
          <PaymentApprovalsTable
            params={params.paymentApprovals ?? DEFAULT_PARAMS_STATE}
            onChangeParams={(newParams) => {
              handleChangeParams({
                ...params,
                paymentApprovals: newParams,
              });
            }}
          />
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
