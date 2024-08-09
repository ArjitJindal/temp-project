import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import SanctionsWhitelistTable from '@/components/SanctionsWhitelistTable';
import { queryAdapter } from '@/pages/sanctions/whitelist/helpers';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { AllParams } from '@/components/library/Table/types';
import { SanctionsWhitelistTableParams } from '@/components/SanctionsWhitelistTable/helpers';

export default function WhitelistTab() {
  const navigate = useNavigate();

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));
  const pushParamsToNavigation = useCallback(
    (params: AllParams<SanctionsWhitelistTableParams>) => {
      navigate(makeUrl('/screening/whitelist', {}, queryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate],
  );

  return (
    <SanctionsWhitelistTable
      params={parsedParams}
      onChangeParams={(newParams) => {
        pushParamsToNavigation(newParams);
      }}
    />
  );
}
