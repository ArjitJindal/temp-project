import { useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalStorageState } from 'ahooks';
import { RiskFactorConfiguration, serializeRiskItem } from '../RiskFactorConfiguration';
import { RiskFactorConfigurationFormValues } from '../RiskFactorConfiguration/RiskFactorConfigurationForm';
import {
  LocalStorageKey,
  RiskFactorsTypeMap,
  scopeToRiskEntityType,
} from '../../RiskFactorsSimulation/SimulationCustomRiskFactors/SimulationCustomRiskFactorsTable';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { CUSTOM_RISK_FACTORS_ITEM, RISK_FACTORS_V8 } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { getOr } from '@/utils/asyncResource';
import { RiskClassificationScore, RiskFactor } from '@/apis';
import { message } from '@/components/library/Message';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';

export default function () {
  const isSimulationMode = window.localStorage.getItem('SIMULATION_CUSTOM_RISK_FACTORS') === 'true';
  const { type = 'consumer', mode = 'read', id, key } = useParams();
  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadcrumbsSimulationPageWrapper
        storageKey={'SIMULATION_CUSTOM_RISK_FACTORS'}
        nonSimulationDefaultUrl="/risk-levels/custom-risk-factors/"
        simulationDefaultUrl="/risk-levels/custom-risk-factors/simulation"
        simulationHistoryUrl="/risk-levels/custom-risk-factors/simulation-history"
        breadcrumbs={[
          {
            title: 'Custom Risk Factors',
            to: `/risk-levels/custom-risk-factors/${isSimulationMode ? 'simulation' : ''}`,
          },
          type === 'consumer' &&
            !isSimulationMode && {
              title: 'Consumer',
              to: '/risk-levels/custom-risk-factors/consumer',
            },
          type === 'business' &&
            !isSimulationMode && {
              title: 'Business',
              to: '/risk-levels/custom-risk-factors/business',
            },
          type === 'transaction' &&
            !isSimulationMode && {
              title: 'Transaction',
              to: '/risk-levels/custom-risk-factors/transaction',
            },
          mode === 'create' && {
            title: 'Create',
            to:
              isSimulationMode && key
                ? makeUrl(`/risk-levels/custom-risk-factors/simulation-mode/:key/:type/:mode`, {
                    key,
                    type,
                    mode,
                  })
                : makeUrl(`/risk-levels/custom-risk-factors/:type/:mode`, {
                    type,
                    mode,
                  }),
          },
          id && {
            title: id,
          },
          (mode === 'read' || mode === 'edit' || mode === 'duplicate') &&
            id && {
              title: mode === 'read' ? 'View' : mode === 'edit' ? 'Edit' : 'duplicate',
              to:
                isSimulationMode && key
                  ? makeUrl(
                      `/risk-levels/custom-risk-factors/simulation-mode/:key/:type/:id/:mode`,
                      {
                        key,
                        type,
                        id,
                        mode,
                      },
                    )
                  : makeUrl(`/risk-levels/custom-risk-factors/:type/:id/:mode`, {
                      type,
                      id,
                      mode,
                    }),
            },
        ].filter(notEmpty)}
      >
        <RiskItem
          type={type as 'consumer' | 'business' | 'transaction'}
          mode={mode}
          id={id}
          dataKey={key}
          isSimulationMode={isSimulationMode}
        />
      </BreadcrumbsSimulationPageWrapper>
    </Feature>
  );
}

interface Props {
  type: 'consumer' | 'business' | 'transaction';
  mode: string;
  id?: string;
  isSimulationMode?: boolean;
  dataKey?: string;
}

const RiskItem = (props: Props) => {
  const { type, mode, id, isSimulationMode, dataKey } = props;
  const navigate = useNavigate();
  const navigateToRiskFactors = () => {
    navigate(makeUrl(`/risk-levels/custom-risk-factors/${isSimulationMode ? 'simulation' : ''}`));
  };
  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);
  if (isSimulationMode) {
    return (
      <SimulationRiskItemForm
        dataKey={dataKey}
        type={type}
        id={id}
        riskClassificationValues={riskClassificationValues}
        navigateToRiskFactors={navigateToRiskFactors}
        mode={mode}
      />
    );
  }
  return (
    <RiskItemForm
      type={type}
      id={id}
      riskClassificationValues={riskClassificationValues}
      mode={mode}
    />
  );
};

interface SimulationRiskItemFormProps {
  type: 'consumer' | 'business' | 'transaction';
  id?: string;
  riskClassificationValues: RiskClassificationScore[];
  navigateToRiskFactors: () => void;
  mode: string;
  dataKey?: string;
}

function SimulationRiskItemForm(props: SimulationRiskItemFormProps) {
  const { type, mode, id, riskClassificationValues, navigateToRiskFactors, dataKey } = props;
  const [riskFactorsMap, setRiskFactorsMap] = useLocalStorageState<RiskFactorsTypeMap>(
    `${LocalStorageKey}-${dataKey}`,
    {
      CONSUMER_USER: [],
      BUSINESS: [],
      TRANSACTION: [],
    },
  );
  const riskFactor = id
    ? riskFactorsMap[scopeToRiskEntityType(type)]?.find((riskFactor) => riskFactor.id === id)
    : undefined;
  return (
    <RiskFactorConfiguration
      riskItemType={type}
      onSubmit={(formValues, riskItem) => {
        if (mode === 'create') {
          const riskFactorCount = Object.values(riskFactorsMap ?? {}).flatMap(
            (riskFactors) => riskFactors,
          ).length;
          setRiskFactorsMap((prev) => {
            const newRiskFactorsMap: RiskFactorsTypeMap = {
              CONSUMER_USER: [...(prev?.CONSUMER_USER ?? [])],
              BUSINESS: [...(prev?.BUSINESS ?? [])],
              TRANSACTION: [...(prev?.TRANSACTION ?? [])],
            };
            newRiskFactorsMap[scopeToRiskEntityType(type)].push({
              ...serializeRiskItem(formValues, type, riskClassificationValues),
              id: `RF-${riskFactorCount.toString().padStart(3, '0')}`,
              status: 'ACTIVE',
            });
            return newRiskFactorsMap;
          });
          navigateToRiskFactors();
        } else if (mode === 'edit' && riskItem) {
          setRiskFactorsMap((prev) => {
            const newRiskFactorsMap: RiskFactorsTypeMap = {
              CONSUMER_USER: [...(prev?.CONSUMER_USER ?? [])],
              BUSINESS: [...(prev?.BUSINESS ?? [])],
              TRANSACTION: [...(prev?.TRANSACTION ?? [])],
            };
            newRiskFactorsMap[scopeToRiskEntityType(type)] = newRiskFactorsMap[
              scopeToRiskEntityType(type)
            ].map((riskFactor) => {
              if (riskFactor.id === id) {
                return {
                  id: riskFactor.id,
                  ...serializeRiskItem(formValues, type, riskClassificationValues),
                  status: riskItem.status,
                };
              }
              return riskFactor;
            });
            return newRiskFactorsMap;
          });
          navigateToRiskFactors();
        }
      }}
      mode={mode.toUpperCase() as 'CREATE' | 'EDIT' | 'READ'}
      id={id}
      dataKey={dataKey}
      riskItem={riskFactor}
      isLoadingUpdation={false}
      isLoadingCreation={false}
    />
  );
}

interface RiskItemFormProps {
  type: 'consumer' | 'business' | 'transaction';
  id?: string;
  riskClassificationValues: RiskClassificationScore[];
  mode: string;
}

function RiskItemForm(props: RiskItemFormProps) {
  const { type, id, riskClassificationValues, mode } = props;
  const navigate = useNavigate();
  const api = useApi();
  const queryResult = useQuery(CUSTOM_RISK_FACTORS_ITEM(type, id), async () => {
    if (id) {
      return await api.getRiskFactor({ riskFactorId: id });
    }
    return null;
  });

  const navigateToRiskFactor = () => {
    navigate(
      makeUrl(`/risk-levels/custom-risk-factors/:type`, {
        type,
      }),
    );
  };

  const queryClient = useQueryClient();
  const updateRiskFactorMutation = useMutation(
    async ({
      variables: { riskFactorFormValues, riskItem },
    }: {
      variables: { riskFactorFormValues: RiskFactorConfigurationFormValues; riskItem: RiskFactor };
    }) => {
      if (!riskItem || !id) {
        throw new Error('Risk item is missing');
      }
      return api.putRiskFactors({
        riskFactorId: id,
        RiskFactorsUpdateRequest: {
          ...serializeRiskItem(riskFactorFormValues, type, riskClassificationValues),
          status: riskItem.status,
        },
      });
    },
    {
      onSuccess: async (newRiskFactor) => {
        navigateToRiskFactor();
        await queryClient.invalidateQueries(RISK_FACTORS_V8(type));
        message.success(`Risk factor updated - ${newRiskFactor.id}`);
      },
      onError: async (err) => {
        message.fatal(`Unable to update the risk factor - Some parameters are missing`, err);
      },
    },
  );
  const createRiskFactorMutation = useMutation(
    async (riskFactorFormValues: RiskFactorConfigurationFormValues) => {
      return api.postCreateRiskFactor({
        RiskFactorsPostRequest: serializeRiskItem(
          riskFactorFormValues,
          type,
          riskClassificationValues,
          id,
          riskFactorFormValues?.v2Props,
        ),
      });
    },
    {
      onSuccess: async (newRiskFactor) => {
        navigateToRiskFactor();
        await queryClient.invalidateQueries(RISK_FACTORS_V8(type));
        message.success(`Risk factor created - ${newRiskFactor.id}`);
      },
      onError: async (err) => {
        message.fatal(`Unable to create the risk factor - Some parameters are missing`, err);
      },
    },
  );
  const handleSubmit = (formValues: RiskFactorConfigurationFormValues, riskItem?: RiskFactor) => {
    if (mode === 'edit' && riskItem) {
      updateRiskFactorMutation.mutate({
        variables: { riskFactorFormValues: formValues, riskItem },
      });
    } else if (mode === 'create' || mode === 'duplicate') {
      createRiskFactorMutation.mutate(formValues);
    }
  };
  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(data) => {
        return (
          <RiskFactorConfiguration
            riskItemType={type}
            onSubmit={handleSubmit}
            mode={mode.toUpperCase() as 'CREATE' | 'EDIT' | 'READ' | 'DUPLICATE'}
            id={id}
            riskItem={data || undefined}
            isLoadingUpdation={updateRiskFactorMutation?.isLoading}
            isLoadingCreation={createRiskFactorMutation?.isLoading}
          />
        );
      }}
    </AsyncResourceRenderer>
  );
}
