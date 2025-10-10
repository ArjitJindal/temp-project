import React from 'react';
import s from './index.module.less';
import { QuestionResponseRuleHit } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';

interface Props {
  item: QuestionResponseRuleHit | any;
}

const PdfRuleHit: React.FC<Props> = ({ item }) => {
  return (
    <div className={s.ruleHitContainer}>
      {item.ruleSummary && (
        <div className={s.ruleField}>
          <strong>Rule Summary:</strong> {item.ruleSummary}
        </div>
      )}
      {item.ruleType && (
        <div className={s.ruleField}>
          <strong>Rule Type:</strong> {item.ruleType}
        </div>
      )}
      {item.hitRulesDetails && (
        <div className={s.ruleField}>
          <strong>Rule Details:</strong>
          <div className={s.ruleDetails}>
            <div>
              <strong>Rule ID:</strong> {item.hitRulesDetails.ruleId || 'N/A'}
            </div>
            <div>
              <strong>Rule Name:</strong> {item.hitRulesDetails.ruleName || 'N/A'}
            </div>
            {item.hitRulesDetails.ruleDescription && (
              <div>
                <strong>Description:</strong> {item.hitRulesDetails.ruleDescription}
              </div>
            )}
            <div>
              <strong>Rule Action:</strong> {item.hitRulesDetails.ruleAction || 'N/A'}
            </div>
            {!item.hitRulesDetails.ruleId?.startsWith('RC') && (
              <>
                <div>
                  <strong>Fuzziness:</strong> {item.ruleParameters?.fuzziness || 'N/A'}
                </div>
                <div>
                  <strong>Screening Types:</strong> {item.ruleParameters?.screeningTypes || 'N/A'}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfRuleHit;
