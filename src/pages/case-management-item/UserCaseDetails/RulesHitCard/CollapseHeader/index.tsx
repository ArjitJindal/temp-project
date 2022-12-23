import s from './index.module.less';
import * as Form from '@/components/ui/Form';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { RulesHitPerCase } from '@/apis';

interface Props {
  hitRuleDetails: RulesHitPerCase;
}

export default function CollapseHeader(props: Props) {
  const { hitRuleDetails } = props;
  return (
    <div className={s.root}>
      <div className={s.fields}>
        <Form.Layout.Label title={'Rule Name'} variant={'bold'} color={'dark'}>
          <span style={{ display: 'inline-block' }}>{hitRuleDetails.ruleName}</span>
        </Form.Layout.Label>
        <Form.Layout.Label title={'Rule Description'} variant={'bold'} color={'dark'}>
          {hitRuleDetails.ruleDescription}
        </Form.Layout.Label>
        <Form.Layout.Label title={'Action'} variant={'bold'} color={'dark'}>
          <RuleActionStatus ruleAction={hitRuleDetails.ruleAction} />
        </Form.Layout.Label>
        <Form.Layout.Label title={'No. of Transactions'} variant={'bold'} color={'dark'}>
          {hitRuleDetails.transactionsCount}
        </Form.Layout.Label>
      </div>
    </div>
  );
}
