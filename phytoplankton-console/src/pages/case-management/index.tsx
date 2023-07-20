import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import CaseTableWrapper from './CaseTableWrapper';
import AlertTable from './AlertTable';
import s from './index.module.less';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { usePageViewTracker } from '@/utils/tracker';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';
import { TableSearchParams } from '@/pages/case-management/types';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { queryAdapter } from '@/pages/case-management/helpers';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useDeepEqualEffect } from '@/utils/hooks';
import ScopeSelector from '@/pages/case-management/components/ScopeSelector';
import StatusButtons from '@/pages/transactions/components/StatusButtons';
import { useAuth0User } from '@/utils/user-utils';
import PaymentApprovalsTable from '@/pages/case-management/PaymentApprovalTable';

export default function CaseManagementPage() {
  const i18n = useI18n();
  usePageViewTracker(`Case Management Page`);
  useCloseSidebarByDefault();

  const user = useAuth0User();
  const navigate = useNavigate();
  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));
  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    ...parsedParams,
  });
  const pushParamsToNavigation = useCallback(
    (params: TableSearchParams) => {
      if (params.showCases === 'ALL' || params.showCases === 'MY') {
        params.alertStatus = undefined;
      } else {
        params.caseStatus = undefined;
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

  useDeepEqualEffect(() => {
    setParams((prevState: AllParams<TableSearchParams>) => ({
      ...prevState,
      ...parsedParams,
      page: parsedParams.page ?? 1,
      sort: parsedParams.sort ?? [],
      pageSize: parsedParams.pageSize ?? DEFAULT_PAGE_SIZE,
    }));
  }, [parsedParams]);

  const isAlerts = params.showCases === 'MY_ALERTS' || params.showCases === 'ALL_ALERTS';
  return (
    <PageWrapper title={i18n('menu.case-management')}>
      <PageWrapperContentContainer>
        <div className={s.header}>
          <ScopeSelector<TableSearchParams>
            params={params}
            onChangeParams={(cb) => {
              handleChangeParams(cb(params));
            }}
          />
          {params.showCases !== 'PAYMENT_APPROVALS' && (
            <StatusButtons
              status={isAlerts ? params.alertStatus : params.caseStatus}
              onChange={(newStatus) => {
                handleChangeParams(
                  isAlerts
                    ? {
                        ...params,
                        alertStatus: newStatus,
                      }
                    : {
                        ...params,
                        caseStatus: newStatus,
                      },
                );
              }}
              suffix={isAlerts ? 'alerts' : 'cases'}
            />
          )}
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
    case 'ALL_ALERTS':
      return (
        <AlertTable
          hideAlertStatusFilters={true}
          escalatedTransactionIds={[]}
          params={{
            ...params,
            assignedTo: params.showCases === 'MY_ALERTS' ? [userId] : params.assignedTo,
          }}
          onChangeParams={handleChangeParams}
        />
      );
    case 'MY':
    case 'ALL':
      return <CaseTableWrapper params={params} onChangeParams={handleChangeParams} />;
    case 'PAYMENT_APPROVALS':
      return <PaymentApprovalsTable />;
  }
}
