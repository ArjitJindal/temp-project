import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import CaseTableWrapper from './CaseTableWrapper';
import AlertTable from './AlertTable';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { usePageViewTracker } from '@/utils/tracker';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';
import { TableSearchParams } from '@/pages/case-management/types';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { queryAdapter } from '@/pages/case-management/helpers';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { useDeepEqualEffect } from '@/utils/hooks';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';

export default function CaseManagementPage() {
  const i18n = useI18n();
  usePageViewTracker(`Case Management Page`);
  useCloseSidebarByDefault();

  const navigate = useNavigate();

  const pushParamsToNavigation = useCallback(
    (params: TableSearchParams) => {
      navigate(makeUrl('/case-management/cases', {}, queryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate],
  );

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));
  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    ...parsedParams,
  });

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

  return (
    <PageWrapper title={i18n('menu.case-management')}>
      {params.showCases === 'MY_ALERTS' ? (
        <AlertTable params={params} onChangeParams={handleChangeParams} />
      ) : (
        <CaseTableWrapper params={params} onChangeParams={handleChangeParams} />
      )}
    </PageWrapper>
  );
}
