import React, { useMemo } from 'react';
import { QuestionResponseRuleHit } from '../../../types';
import s from './index.module.less';
import RuleSummary from './RuleSummary';
import * as Form from '@/components/ui/Form';
import { getRuleInstanceDisplayId } from '@/pages/rules/utils';
import Id from '@/components/ui/Id';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { RuleLogicBuilder } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/RuleLogicBuilder';

interface Props {
  item: QuestionResponseRuleHit;
}

export default function HistoryItemRuleHit(props: Props) {
  const { item } = props;

  const {
    hitRulesDetails,
    ruleSummary,
    ruleLogic,
    ruleType,
    logicEntityVariables,
    logicMlVariables,
    logicAggregationVariables,
  } = item;

  const configParams = useMemo(
    () => ({
      mode: 'VIEW' as const,
    }),
    [],
  );
  return (
    <div className={s.root}>
      <div className={s.header}>
        <Form.Layout.Label title={'Rule ID'}>
          <Id to={`/rules/my-rules/${hitRulesDetails.ruleInstanceId}/read`}>
            {getRuleInstanceDisplayId(hitRulesDetails.ruleId, hitRulesDetails.ruleInstanceId)}
          </Id>
        </Form.Layout.Label>
        <Form.Layout.Label title={'Rule name'}>{hitRulesDetails.ruleName}</Form.Layout.Label>
        <Form.Layout.Label title={'Rule description'}>
          {hitRulesDetails.ruleDescription}
        </Form.Layout.Label>
        <Form.Layout.Label title={'Rule action'}>
          <RuleActionStatus ruleAction={hitRulesDetails.ruleAction} />
        </Form.Layout.Label>
      </div>
      <div className={s.subtitle}>Rule logic</div>
      <div className={s.logicAndSummary}>
        <div className={s.logicBuilder}>
          <RuleLogicBuilder
            configParams={configParams}
            ruleType={ruleType}
            jsonLogic={ruleLogic}
            entityVariablesInUse={logicEntityVariables}
            aggregationVariables={logicAggregationVariables}
            mlVariables={logicMlVariables}
          />
        </div>
        {ruleSummary && <RuleSummary>{ruleSummary}</RuleSummary>}
      </div>
    </div>
  );
}
