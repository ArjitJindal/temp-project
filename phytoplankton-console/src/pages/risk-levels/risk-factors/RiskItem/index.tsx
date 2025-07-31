import { useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import { useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { RiskFactorConfiguration } from '../RiskFactorConfiguration';
import { RiskFactorsTypeMap, scopeToRiskEntityType } from '../RiskFactorsTable/utils';
import {
  RiskFactorConfigurationFormValues,
  serializeRiskItem,
} from '../RiskFactorConfiguration/utils';
import {
  riskFactorsAtom,
  riskFactorsEditEnabled,
  SimulationLocalStorageKey,
} from '@/store/risk-factors';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { CUSTOM_RISK_FACTORS_ITEM, RISK_FACTORS_V8 } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { RiskClassificationScore, RiskFactor, RiskFactorParameter } from '@/apis';
import { message } from '@/components/library/Message';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { useAuth0User } from '@/utils/user-utils';
import { useSafeLocalStorageState } from '@/utils/hooks';

export default function () {
  const isSimulationMode = window.localStorage.getItem('SIMULATION_CUSTOM_RISK_FACTORS') === 'true';
  const params = useParams();
  const type = params.type || 'consumer';
  const mode = window.location.pathname.endsWith('/create')
    ? 'create'
    : window.location.pathname.endsWith('/edit')
    ? 'edit'
    : window.location.pathname.endsWith('/duplicate')
    ? 'duplicate'
    : 'read';

  const id = params.id;
  const key = params.key;

  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadCrumbsWrapper
        simulationStorageKey={'SIMULATION_CUSTOM_RISK_FACTORS'}
        nonSimulationDefaultUrl="/risk-levels/risk-factors/"
        simulationDefaultUrl="/risk-levels/risk-factors/simulation"
        simulationHistoryUrl="/risk-levels/risk-factors/simulation-history"
        breadcrumbs={[
          {
            title: 'Risk Factors',
            to: `/risk-levels/risk-factors/${isSimulationMode ? 'simulation' : ''}`,
          },
          type === 'consumer' &&
            !isSimulationMode && {
              title: 'Consumer',
              to: '/risk-levels/risk-factors/consumer',
            },
          type === 'business' &&
            !isSimulationMode && {
              title: 'Business',
              to: '/risk-levels/risk-factors/business',
            },
          type === 'transaction' &&
            !isSimulationMode && {
              title: 'Transaction',
              to: '/risk-levels/risk-factors/transaction',
            },
          mode === 'create' && {
            title: 'Create',
            to: isSimulationMode
              ? makeUrl(`/risk-levels/risk-factors/:key/:type/:mode`, {
                  key: 'simulation-mode',
                  type,
                  mode,
                })
              : makeUrl(`/risk-levels/risk-factors/:type/:mode`, {
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
              to: isSimulationMode
                ? makeUrl(`/risk-levels/risk-factors/:type/:id/:mode`, {
                    type: 'simulation-mode',
                    id,
                    mode,
                  })
                : makeUrl(`/risk-levels/risk-factors/:type/:id/:mode`, {
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
      </BreadCrumbsWrapper>
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

  useEffect(() => {
    if (isSimulationMode) {
      const handleBackButton = (event) => {
        event.preventDefault();
        navigate('/risk-levels/risk-factors/simulation', { replace: true });
      };

      window.history.pushState(null, '', window.location.pathname);
      window.addEventListener('popstate', handleBackButton);

      return () => {
        window.removeEventListener('popstate', handleBackButton);
      };
    }
  }, [isSimulationMode, navigate]);

  const navigateToRiskFactors = () => {
    if (isSimulationMode) {
      navigate('/risk-levels/risk-factors/simulation', { replace: true });
    } else {
      navigate(makeUrl(`/risk-levels/risk-factors/${type}`), { replace: true });
    }
  };
  const riskClassificationValues = useRiskClassificationScores();
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
  const [riskFactorsMap, setRiskFactorsMap] = useSafeLocalStorageState<RiskFactorsTypeMap>(
    `${SimulationLocalStorageKey}-${dataKey}`,
    {
      CONSUMER_USER: [],
      BUSINESS: [],
      TRANSACTION: [],
    },
  );
  const riskFactor = id
    ? riskFactorsMap[scopeToRiskEntityType(type)]?.find((riskFactor) => riskFactor.id === id)
    : undefined;

  // Don't wait for data if we're creating a new risk factor
  if (mode === 'create') {
    return (
      <RiskFactorConfiguration
        riskItemType={type}
        onSubmit={(formValues) => {
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
        }}
        mode={'CREATE'}
        dataKey={dataKey}
        isLoading={false}
      />
    );
  }

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
                  ...riskFactor,
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
      mode={mode.toUpperCase() as 'CREATE' | 'EDIT' | 'READ' | 'DUPLICATE'}
      id={id}
      dataKey={dataKey}
      riskItem={riskFactor}
      isLoading={false}
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
  const user = useAuth0User();
  const queryResult = useQuery(CUSTOM_RISK_FACTORS_ITEM(type, id), async () => {
    if (id) {
      return await api.getRiskFactor({ riskFactorId: id });
    }
    return null;
  });
  const [riskFactors, setRiskFactors] = useAtom(riskFactorsAtom);

  const navigateToRiskFactor = () => {
    navigate(
      makeUrl(`/risk-levels/risk-factors/:type`, {
        type,
      }),
    );
  };

  const queryClient = useQueryClient();

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
        message.success('Risk factor created successfully', {
          link: makeUrl(`/risk-levels/risk-factors/:type/:id/read`, {
            type,
            id: newRiskFactor.id,
          }),
          linkTitle: 'View risk factor',
          details: `${capitalizeNameFromEmail(user?.name || '')} created a risk factor ${
            newRiskFactor.id
          }`,
          copyFeedback: 'Risk factor URL copied to clipboard',
        });
      },
      onError: async (err) => {
        message.fatal(`Unable to create the risk factor - Some parameters are missing`, err);
      },
    },
  );
  const isEditEnabled = useAtomValue(riskFactorsEditEnabled);
  const handleSubmit = (formValues: RiskFactorConfigurationFormValues, riskItem?: RiskFactor) => {
    if (mode === 'edit' && riskItem && isEditEnabled) {
      if (id == null) {
        throw new Error(`ID must be defined for editing`);
      }
      const serialized = serializeRiskItem(formValues, type, riskClassificationValues);
      setRiskFactors({
        id,
        ...serialized,
      });
      navigateToRiskFactor();
    } else if (mode === 'create' || mode === 'duplicate') {
      if (mode === 'duplicate' && riskItem) {
        if (riskItem.parameter) {
          if (!formValues.v2Props) {
            formValues.v2Props = {
              parameter: riskItem.parameter as RiskFactorParameter,
              item: {
                ...riskItem,
                name: formValues.basicDetailsStep.name || '',
                description: formValues.basicDetailsStep.description || '',
              },
            };
          }
        }
      }

      if (mode !== 'duplicate' && formValues.riskFactorConfigurationStep) {
        delete (formValues.riskFactorConfigurationStep as any).riskFactorId;
      }
      createRiskFactorMutation.mutate(formValues);
    }
  };

  if (mode === 'create') {
    return (
      <RiskFactorConfiguration
        riskItemType={type}
        onSubmit={handleSubmit}
        mode={mode.toUpperCase() as 'CREATE' | 'EDIT' | 'READ' | 'DUPLICATE'}
        isLoading={createRiskFactorMutation?.isLoading}
      />
    );
  }

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(data) => {
        return (
          <RiskFactorConfiguration
            riskItemType={type}
            onSubmit={handleSubmit}
            mode={mode.toUpperCase() as 'CREATE' | 'EDIT' | 'READ' | 'DUPLICATE'}
            id={id}
            riskItem={(id ? riskFactors.getById(id) ?? data : data) ?? undefined}
            isLoading={false}
          />
        );
      }}
    </AsyncResourceRenderer>
  );
}
