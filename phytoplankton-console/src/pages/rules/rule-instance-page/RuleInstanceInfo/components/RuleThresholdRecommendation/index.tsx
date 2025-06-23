import { useState } from 'react';
import { useNavigate } from 'react-router';
import ExtendedRowRenderer from '../ExtendedRowRenderer';
import s from './index.module.less';
import { useApi } from '@/api';
import {
  LogicAggregationVariable,
  LogicEntityVariableInUse,
  RuleInstance,
  RuleType,
  VarThresholdData,
} from '@/apis';
import Button from '@/components/library/Button';
import Modal from '@/components/library/Modal';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { NUMBER } from '@/components/library/Table/standardDataTypes';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useLogicEntityVariablesList } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';
import { getOr, isLoading, map } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { THRESHOLD_RECOMMENDATIONS } from '@/utils/queries/keys';
import Icon from '@/components/ui/icons/Remix/system/arrow-down-line.react.svg';
import Tag from '@/components/library/Tag';
import { getAggVarDefinition } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/utils';
import { useUpdateRuleInstance } from '@/pages/rules/utils';
import { makeUrl } from '@/utils/routing';
import {
  EMPTY_THRESHOLD_DATA,
  updateCurrentInstance,
  UPDATED_VAR_DATA_KEY,
} from '@/utils/ruleThreshold';
import { useSafeLocalStorageState } from '@/utils/hooks';
interface Props {
  ruleInstance: RuleInstance;
  entityVariables?: LogicEntityVariableInUse[];
  aggregationVariables?: LogicAggregationVariable[];
  type: RuleType;
}

export default function RuleThresholdRecommendation(props: Props) {
  const { ruleInstance, entityVariables, aggregationVariables, type } = props;
  const ruleLogicConfig = useLogicEntityVariablesList(type);
  const [showRecommendations, setShowRecommendations] = useState<boolean>(false);
  const [isSimulationModeEnabled, setIsSimulationModeEnabled] = useSafeLocalStorageState(
    'SIMULATION_RULES',
    false,
  );
  const [_simulationVarUpdatedData, setSimulationVarUpdatedData] =
    useSafeLocalStorageState<VarThresholdData>(UPDATED_VAR_DATA_KEY, EMPTY_THRESHOLD_DATA);
  const helper = new ColumnHelper<VarThresholdData>();
  const api = useApi();
  const navigate = useNavigate();
  const recommendationResult = useQuery(
    THRESHOLD_RECOMMENDATIONS(ruleInstance.id ?? ''),
    async () => {
      const result = await api.getRuleInstanceRuleInstanceIdRecommendation({
        ruleInstanceId: ruleInstance.id ?? '',
      });
      return result;
    },
  );
  const data = getOr(recommendationResult.data, {
    ruleInstanceId: ruleInstance.id ?? '',
    varsThresholdData: [],
    isReady: false,
  });
  const updateRuleInstanceMutation = useUpdateRuleInstance(() => {
    navigate(makeUrl(`/rules/my-rules`));
  });
  return (
    <AsyncResourceRenderer resource={ruleLogicConfig}>
      {(variables) => (
        <>
          <Button
            isLoading={isLoading(recommendationResult.data)}
            onClick={() => {
              setShowRecommendations(true);
            }}
            isDisabled={!data.isReady}
          >
            Recommended thresholds
          </Button>
          <Modal
            isOpen={showRecommendations}
            onCancel={() => {
              setShowRecommendations(false);
            }}
            hideFooter
            title={'Threshold recommendation'}
            width="XL"
          >
            <Table
              data={
                // Todo
                map(recommendationResult.data, (val) => ({
                  items: val.varsThresholdData,
                }))
              }
              hideFilters
              toolsOptions={false}
              rowKey="varKey"
              columns={[
                helper.display({
                  title: 'Variable',
                  id: 'variable',
                  defaultWidth: 600,
                  render: (item) => {
                    let name: string = '';
                    if (item.varKey.startsWith('agg:')) {
                      const aggVar = aggregationVariables?.find((val) => val.key === item.varKey);
                      name = aggVar
                        ? aggVar.name ??
                          getAggVarDefinition(aggVar, variables).uiDefinition.label ??
                          ''
                        : '';
                    } else {
                      const variable = entityVariables?.find((val) => val.key === item.varKey); // Todo
                      name =
                        variable?.name ??
                        variables.find((val) => val.key === variable?.entityKey)?.uiDefinition
                          .label ??
                        '';
                    }
                    return (
                      <Tag color="action" trimText={false}>
                        {name}
                      </Tag>
                    );
                  },
                }),
                helper.simple({
                  title: 'Recommended value',
                  key: 'threshold',
                  type: NUMBER,
                  defaultWidth: 200,
                }),
                helper.display({
                  title: 'False positives reduced by',
                  id: 'falsePositivesReduced',
                  defaultWidth: 200,
                  render: (item) => {
                    return (
                      <div className={s.falsePositive}>
                        <>{item.falsePositivesReduced}%</>
                        <Icon className={s.icon} />
                      </div>
                    );
                  },
                }),
                helper.display({
                  title: '',
                  id: 'actions',
                  defaultWidth: 260,
                  render: (item) => {
                    return (
                      <div className={s.actions}>
                        <Button
                          type="TETRIARY"
                          isDisabled={isSimulationModeEnabled}
                          onClick={() => {
                            if (!isSimulationModeEnabled) {
                              setIsSimulationModeEnabled(true);
                            }
                            setSimulationVarUpdatedData(item);
                            navigate(
                              makeUrl('/rules/my-rules/:id/:mode', {
                                id: ruleInstance.id,
                                mode: 'edit',
                              }),
                            );
                          }}
                        >
                          Run simulation
                        </Button>
                        <Button
                          type="TETRIARY"
                          onClick={() => {
                            const updatedRuleInstance = updateCurrentInstance(ruleInstance, item);
                            updateRuleInstanceMutation.mutate(updatedRuleInstance);
                          }}
                        >
                          Update rule
                        </Button>
                      </div>
                    );
                  },
                }),
              ]}
              isExpandable={() => true}
              renderExpanded={(data) => {
                return (
                  <ExtendedRowRenderer
                    data={{
                      ...data,
                      createdAt: ruleInstance.createdAt,
                    }}
                  />
                );
              }}
            />
          </Modal>
        </>
      )}
    </AsyncResourceRenderer>
  );
}
