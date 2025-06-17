import { useCallback } from 'react';
import SanctionsWhitelistTable from '@/components/SanctionsWhitelistTable';
import { queryAdapter } from '@/pages/sanctions/whitelist/helpers';
import { makeUrl, useNavigationParams } from '@/utils/routing';
import { AllParams } from '@/components/library/Table/types';
import { SanctionsWhitelistTableParams } from '@/components/SanctionsWhitelistTable/helpers';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';

export default function WhitelistTab() {
  const [params, setParams] = useNavigationParams<AllParams<SanctionsWhitelistTableParams>>({
    queryAdapter: {
      serializer: queryAdapter.serializer,
      deserializer: (raw) => ({
        ...DEFAULT_PARAMS_STATE,
        ...queryAdapter.deserializer(raw),
      }),
    },
    makeUrl: (rawQueryParams) => makeUrl('/screening/whitelist', {}, rawQueryParams),
    persist: {
      id: 'sanctions-whitelist-navigation-params',
    },
  });

  const handleChangeParams = useCallback(
    (newParams: AllParams<SanctionsWhitelistTableParams>) => {
      setParams(newParams);
    },
    [setParams],
  );

  return <SanctionsWhitelistTable params={params} onChangeParams={handleChangeParams} />;
}
