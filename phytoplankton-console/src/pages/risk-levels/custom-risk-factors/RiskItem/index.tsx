import { useParams } from 'react-router';
import { RiskFactorConfiguration } from '../RiskFactorConfiguration';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import PageWrapper from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { CUSTOM_RISK_FACTORS_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

export default function () {
  const { type = 'consumer', mode = 'read', id } = useParams();
  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <Feature name="CUSTOM_RISK_FACTORS" fallback={'Not enabled'}>
        <PageWrapper
          header={
            <Breadcrumbs
              items={[
                {
                  title: 'Custom Risk Factors',
                  to: '/risk-levels/custom-risk-factors',
                },
                type === 'consumer' && {
                  title: 'Consumer',
                  to: '/risk-levels/custom-risk-factors/consumer',
                },
                type === 'business' && {
                  title: 'Business',
                  to: '/risk-levels/custom-risk-factors/business',
                },
                type === 'transaction' && {
                  title: 'Transaction',
                  to: '/risk-levels/custom-risk-factors/transaction',
                },
                mode === 'create' && {
                  title: 'Create',
                  to: makeUrl(`/risk-levels/custom-risk-factors/:type/:mode`, { type, mode }),
                },
                id && {
                  title: id,
                },
                (mode === 'read' || mode === 'edit') &&
                  id && {
                    title: mode === 'read' ? 'View' : 'Edit',
                    to: makeUrl(`/risk-levels/custom-risk-factors/:type/:id/:mode`, {
                      type,
                      id,
                      mode,
                    }),
                  },
              ].filter(notEmpty)}
            />
          }
        >
          <RiskItem type={type} mode={mode} id={id} />
        </PageWrapper>
      </Feature>
    </Feature>
  );
}

interface Props {
  type: string;
  mode: string;
  id?: string;
}

const RiskItem = (props: Props) => {
  const { type, mode, id } = props;
  const api = useApi();
  const queryResult = useQuery(CUSTOM_RISK_FACTORS_ITEM(type, id), async () => {
    if (id) {
      return await api.getPulseRiskParameterIdRiskParametersV8({ riskParameterId: id });
    }
    return null;
  });
  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(data) => {
        return (
          <RiskFactorConfiguration
            riskItemType={type as 'consumer' | 'business' | 'transaction'}
            mode={mode.toUpperCase() as 'CREATE' | 'EDIT' | 'READ'}
            id={id}
            riskItem={data === null ? undefined : data}
          />
        );
      }}
    </AsyncResourceRenderer>
  );
};
