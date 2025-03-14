import React, { useState } from 'react';
import { useApi } from '@/api';
import {
  LogicAggregationVariable,
  LogicEntityVariableInUse,
  RuleType,
  VarThresholdData,
} from '@/apis';
import Button from '@/components/library/Button';
import Modal from '@/components/library/Modal';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { NUMBER } from '@/components/library/Table/standardDataTypes';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useRuleLogicConfig } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';
import { getOr, isLoading, map } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { THRESHOLD_RECOMMENDATIONS } from '@/utils/queries/keys';

interface Props {
  id: string;
  entityVariables?: LogicEntityVariableInUse[];
  aggregationVariables?: LogicAggregationVariable[];
  type: RuleType;
}

export default function RuleThresholdRecommendation(props: Props) {
  const { id, entityVariables, aggregationVariables, type } = props;
  const ruleLogicConfig = useRuleLogicConfig(type);
  const [showRecommendations, setShowRecommendations] = useState<boolean>(false);
  const helper = new ColumnHelper<VarThresholdData>();
  const api = useApi();
  const recommendationResult = useQuery(THRESHOLD_RECOMMENDATIONS(), async () => {
    const result = await api.getRuleInstanceRuleInstanceIdRecommendation({
      ruleInstanceId: id ?? '',
    });
    return result;
  });
  const data = getOr(recommendationResult.data, {
    ruleInstanceId: id,
    varsThresholdData: [],
    isReady: false,
  });
  return (
    <AsyncResourceRenderer resource={ruleLogicConfig.data}>
      {(logicData) => (
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
            title={'Threshold recommendations'}
          >
            <Table
              data={map(recommendationResult.data, (val) => ({
                items: val.varsThresholdData,
              }))}
              hideFilters
              toolsOptions={false}
              rowKey="varKey"
              columns={[
                helper.display({
                  title: 'Variable',
                  id: 'variable',
                  defaultWidth: 200,
                  render: (item) => {
                    if (item.varKey.startsWith('agg:')) {
                      return (
                        <>
                          {aggregationVariables?.find((val) => val.key === item.varKey)?.name ?? ''}
                        </>
                      );
                    } else {
                      const variable = entityVariables?.find((val) => val.key === item.varKey);
                      return (
                        <>
                          {variable?.name ??
                            logicData.variables.find((val) => val.key === variable?.entityKey)
                              ?.uiDefinition.label ??
                            ''}
                        </>
                      );
                    }
                  },
                }),
                helper.simple({
                  title: 'Suggested Threshold',
                  key: 'threshold',
                  type: NUMBER,
                  defaultWidth: 200,
                }),
              ]}
            ></Table>
          </Modal>
        </>
      )}
    </AsyncResourceRenderer>
  );
}
