import React from 'react';

//css
import s from './index.module.less';

//components
import ActionRiskDisplay from '@/components/ui/ActionRiskDisplay';
import AIRiskDisplay from '@/components/ui/AIRiskDisplay';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import * as Form from '@/components/ui/Form';
import TransactionState from '@/components/ui/TransactionStateTag';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import TransactionTypeTag from '@/components/library/TransactionTypeTag';

//types
import { InternalTransaction } from '@/apis';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';

interface Props {
  transaction: InternalTransaction;
}

export default function SubHeader(props: Props) {
  const { transaction } = props;

  return (
    <div className={s.root}>
      <div className={s.attributes}>
        <Form.Layout.Label title="Created at" className={s.attribute}>
          {dayjs(transaction.timestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
        </Form.Layout.Label>
        <Form.Layout.Label title="State" className={s.attribute}>
          <TransactionState transactionState={transaction.transactionState} />
        </Form.Layout.Label>
        <Form.Layout.Label title="Rule action" className={s.attribute}>
          {transaction.status && <RuleActionStatus ruleAction={transaction.status} />}
        </Form.Layout.Label>
        <Form.Layout.Label title="Type" className={s.attribute}>
          <TransactionTypeTag transactionType={transaction.type} />
        </Form.Layout.Label>
        <Form.Layout.Label title="Product Type" className={s.attribute}>
          {transaction.productType ?? '-'}
        </Form.Layout.Label>
        <Form.Layout.Label title="Reference" className={s.attribute}>
          {transaction.reference ?? '-'}
        </Form.Layout.Label>
      </div>

      <Feature name="RISK_SCORING">
        <div className={s.risks}>
          <ActionRiskDisplay transactionId={transaction.transactionId} />
          <Feature name="MACHINE_LEARNING_DEMO">
            <AIRiskDisplay />
          </Feature>
        </div>
      </Feature>
    </div>
  );
}
