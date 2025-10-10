import React from 'react';
import { QuestionResponseRuleHit } from '../../../types';
import s from './index.module.less';
import RuleSummary from './RuleSummary';
import * as Form from '@/components/ui/Form';
import { getRuleInstanceDisplayId } from '@/pages/rules/utils';
import Id from '@/components/ui/Id';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import RuleLogicDisplay from '@/components/ui/RuleLogicDisplay';

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
    ruleParameters,
  } = item;

  // Extract individual parameters
  const { fuzziness, screeningTypes } = ruleParameters || {};

  return (
    <div className={s.root}>
      <div className={s.ruleInfo}>
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
        {!hitRulesDetails.ruleId?.startsWith('RC') && (
          <>
            <Form.Layout.Label title={'Fuzziness'}>
              {fuzziness !== undefined ? fuzziness : 'N/A'}
            </Form.Layout.Label>
            <Form.Layout.Label title={'Screening Types'}>
              {screeningTypes
                ? screeningTypes.map((type, index) => (
                    <React.Fragment key={index}>
                      {type.replace(/_/g, ' ')}
                      {index < screeningTypes.length - 1 ? ', ' : ''}
                    </React.Fragment>
                  ))
                : 'N/A'}
            </Form.Layout.Label>
          </>
        )}
      </div>

      {/* Display Rule Logic and Summary for RC rules */}
      {ruleType && ruleLogic && hitRulesDetails.ruleId?.startsWith('RC') && (
        <>
          <div className={s.subtitle}>Rule logic</div>
          <div className={s.logicAndSummary}>
            <div className={s.logicBuilder}>
              <RuleLogicDisplay
                ruleType={ruleType}
                ruleLogic={ruleLogic}
                logicEntityVariables={logicEntityVariables}
                logicMachineLearningVariables={logicMlVariables}
                logicAggregationVariables={logicAggregationVariables}
              />
            </div>
            {ruleSummary && <RuleSummary>{ruleSummary}</RuleSummary>}
          </div>
        </>
      )}
    </div>
  );
}
