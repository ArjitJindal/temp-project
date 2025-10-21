import { useMemo } from 'react';
import { DEFAULT_RISK_LEVEL } from '@flagright/lib/utils';
import { Alert, InternalBusinessUser, InternalConsumerUser, RuleInstance } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { AsyncResource, isSuccess, loading, map, success } from '@/utils/asyncResource';
import { USERS_ITEM } from '@/utils/queries/keys';
import {
  QuestionResponse,
  QuestionResponseRuleHit,
  QuestionResponseSkeleton,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { useRules } from '@/utils/rules';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export function usePreloadedHistory(
  alert: Alert,
  caseUserId: string,
): (QuestionResponse | QuestionResponseSkeleton)[] {
  const { ruleInstances, isLoading: isRulesLoading } = useRules();

  const ruleInstanceRes: AsyncResource<RuleInstance | undefined> = isRulesLoading
    ? loading()
    : success(ruleInstances[alert.ruleInstanceId]);

  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  const riskEnabled = useFeatureEnabled('RISK_LEVELS');
  const api = useApi();
  const queryResult = useQuery<InternalConsumerUser | InternalBusinessUser>(
    USERS_ITEM(caseUserId),
    () => {
      if (caseUserId == null) {
        throw new Error(`Id is not defined`);
      }
      return api.getUsersItem({ userId: caseUserId });
    },
  );

  const riskLevelRes = map(queryResult.data, (x) => {
    return x.drsScore?.manualRiskLevel ?? x.drsScore?.derivedRiskLevel ?? DEFAULT_RISK_LEVEL;
  });

  return useMemo((): (QuestionResponse | QuestionResponseSkeleton)[] => {
    const result: QuestionResponseRuleHit = {
      questionType: 'RULE_HIT',
      questionId: `rule_hit_predefined_${Date.now()}`,
      variableOptions: [],
      title: 'Rule hit',
      createdById: '',
      hitRulesDetails: {
        ruleId: alert.ruleId,
        ruleInstanceId: alert.ruleInstanceId,
        ruleName: alert.ruleName,
        ruleDescription: alert.ruleDescription,
        ruleAction: alert.ruleAction,
      },
    };

    if (isSuccess(riskLevelRes) && isSuccess(ruleInstanceRes)) {
      const riskLevel = riskLevelRes.value;
      const ruleInstance = ruleInstanceRes.value;

      if (ruleInstance) {
        const isV8RuleInstance = v8Enabled && (ruleInstance?.logic || ruleInstance?.riskLevelLogic);

        let logic: any;
        let parameters: any;
        if (
          isV8RuleInstance &&
          riskEnabled &&
          riskLevel &&
          ruleInstance.riskLevelLogic?.[riskLevel]
        ) {
          logic = ruleInstance.riskLevelLogic?.[riskLevel];
          parameters = ruleInstance.riskLevelParameters?.[riskLevel];
        } else {
          logic = ruleInstance.logic;
          parameters = ruleInstance.parameters;
        }

        result.ruleType = ruleInstance?.type;
        result.ruleLogic = logic;
        result.ruleParameters = parameters;
        result.logicAggregationVariables = ruleInstance.logicAggregationVariables ?? [];
        result.logicEntityVariables = ruleInstance.logicEntityVariables ?? [];
        result.logicMlVariables = ruleInstance.logicMachineLearningVariables ?? [];
      }
    }

    return [result];
  }, [
    alert.ruleAction,
    alert.ruleDescription,
    alert.ruleId,
    alert.ruleInstanceId,
    alert.ruleName,
    v8Enabled,
    ruleInstanceRes,
    riskLevelRes,
    riskEnabled,
  ]);
}
