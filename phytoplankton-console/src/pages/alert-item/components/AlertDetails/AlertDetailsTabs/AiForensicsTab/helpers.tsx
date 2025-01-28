import { ReactNode, useMemo } from 'react';
import { Alert, InternalBusinessUser, InternalConsumerUser, RuleInstance } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { useCheckedTransactionsQuery } from '@/pages/transactions/components/TransactionsTable/DisplayCheckedTransactions/helpers';
import { AsyncResource, isSuccess, loading, map, success } from '@/utils/asyncResource';
import Money from '@/components/ui/Money';
import { ALERT_ITEM_TRANSACTION_STATS, USERS_ITEM } from '@/utils/queries/keys';
import {
  QuestionResponse,
  QuestionResponseRuleHit,
  QuestionResponseSkeleton,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { useRules } from '@/utils/rules';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface StatsItem {
  title: string;
  children: AsyncResource<ReactNode>;
}

export default function useStats(alert: Alert, caseUserId: string): StatsItem[] {
  const result: StatsItem[] = [];

  const checkedTransactionsQuery = useCheckedTransactionsQuery(alert, caseUserId);

  const api = useApi();

  const transactionsStatsQueryResult = useQuery(
    ALERT_ITEM_TRANSACTION_STATS(alert.alertId ?? ''),
    () => {
      if (alert.alertId == null) {
        throw new Error(`Alert id can not be empty`);
      }
      return api.getAlertTransactionStats({
        alertId: alert.alertId,
        referenceCurrency: 'USD',
      });
    },
  );

  result.push({
    title: 'Transactions checked',
    children: map(checkedTransactionsQuery.data, (x) => x.count.toString()),
  });

  result.push({
    title: 'Transactions hit',
    children: success((alert.transactionIds?.length ?? 0).toString()),
  });

  result.push({
    title: 'Total amount transacted',
    children: map(transactionsStatsQueryResult.data, (stats) => (
      <Money
        value={stats.totalTransactionsAmount.amount}
        currency={stats.totalTransactionsAmount.currency}
      />
    )),
  });

  result.push({
    title: 'No. of Users transacted with',
    children: map(transactionsStatsQueryResult.data, (stats) => stats.numberOfUsersTransactedWith),
  });

  return result;
}

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
    return x.drsScore?.manualRiskLevel ?? x.drsScore?.derivedRiskLevel;
  });

  return useMemo((): (QuestionResponse | QuestionResponseSkeleton)[] => {
    const result: QuestionResponseRuleHit = {
      questionType: 'RULE_HIT',
      questionId: `rule_hit_predefined_${Date.now()}}`,
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
        if (
          isV8RuleInstance &&
          riskEnabled &&
          riskLevel &&
          ruleInstance.riskLevelLogic?.[riskLevel]
        ) {
          logic = ruleInstance.riskLevelLogic?.[riskLevel];
        } else {
          logic = ruleInstance.logic;
        }

        result.ruleType = ruleInstance?.type;
        result.ruleLogic = logic;
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
