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
import { useAuth0User } from '@/utils/user-utils';
import PaymentApprovalsTable from '@/pages/case-management/PaymentApprovalTable';
import Toggle from '@/components/library/Toggle';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Item } from '@/components/library/SegmentedControl';
import QaTable from '@/pages/case-management/QaTable';
import { useQaMode } from '@/utils/qa-mode';

export default function CaseManagementPage() {
  const i18n = useI18n();
  useCloseSidebarByDefault();
  const [qaMode, setQaMode] = useQaMode();
  const hasQaEnabled = useFeatureEnabled('QA');
  const user = useAuth0User();
  const navigate = useNavigate();
  const parsedParams = queryAdapter.deserializer({
    showCases: qaMode ? 'QA_UNCHECKED_ALERTS' : 'ALL',
    ...parseQueryString(location.search),
  });
  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    ...parsedParams,
  });

  useEffect(() => {
    if (qaMode) {
      setParams((params) => ({ ...params, showCases: 'QA_UNCHECKED_ALERTS' }));
    } else {
      setParams((params) => ({ ...params, showCases: 'ALL' }));
    }
  }, [qaMode]);

  const pushParamsToNavigation = useCallback(
    (params: TableSearchParams) => {
      if (params.showCases === 'ALL' || params.showCases === 'MY') {
        params.alertStatus = undefined;
      } else {
        params.caseStatus = undefined;
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

  const settings = useSettings();
  useDeepEqualEffect(() => {
    setParams((prevState: AllParams<TableSearchParams>) => ({
      ...prevState,
      ...parsedParams,
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
    { value: 'QA_UNCHECKED_ALERTS', label: 'All closed alerts' },
    { value: 'QA_PASSED_ALERTS', label: 'Passed alerts' },
    { value: 'QA_FAILED_ALERTS', label: 'Failed alerts' },
  ];

  return (
    <PageWrapper
      title={i18n('menu.case-management')}
      actionButton={
        hasQaEnabled && (
          <div className={s.qaSwitch}>
            <p className={s.qaSwitchTitle}>QA</p>
            <Toggle value={qaMode} onChange={(value) => setQaMode(!!value)} disabled={false} />
          </div>
        )
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
          {qaMode || <StatusButtons params={params} onChangeParams={handleChangeParams} />}
        </div>
        {getTable(user.userId, params, handleChangeParams)}
      </PageWrapperContentContainer>
    </PageWrapper>
  );
}

function getTable(
  userId: string,
  params: AllParams<TableSearchParams>,
  handleChangeParams: (newParams: AllParams<TableSearchParams>) => void,
) {
  switch (params.showCases) {
    case 'MY_ALERTS':
      return (
        <AlertTable
          hideAlertStatusFilters={true}
          escalatedTransactionIds={[]}
          params={params}
          onChangeParams={handleChangeParams}
          showAssignedToFilter={false}
        />
      );
    case 'ALL_ALERTS':
      return (
        <AlertTable
          hideAlertStatusFilters={true}
          escalatedTransactionIds={[]}
          params={params}
          onChangeParams={handleChangeParams}
        />
      );
    case 'MY':
    case 'ALL':
      return <CaseTableWrapper params={params} onChangeParams={handleChangeParams} />;
    case 'PAYMENT_APPROVALS':
      return <PaymentApprovalsTable filterStatus={params.status} />;
    case 'QA_UNCHECKED_ALERTS':
      return (
        <QaTable
          params={{ ...params, alertStatus: 'CLOSED' }}
          onChangeParams={handleChangeParams}
        />
      );
    case 'QA_PASSED_ALERTS':
      return (
        <QaTable
          params={{ ...params, filterQaStatus: ['PASSED'], alertStatus: 'CLOSED' }}
          onChangeParams={handleChangeParams}
        />
      );
    case 'QA_FAILED_ALERTS':
      return (
        <QaTable
          params={{ ...params, filterQaStatus: ['FAILED'], alertStatus: 'CLOSED' }}
          onChangeParams={handleChangeParams}
        />
      );
  }
}
