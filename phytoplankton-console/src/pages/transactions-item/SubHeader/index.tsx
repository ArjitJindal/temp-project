import React from 'react';

//css
import s from './index.module.less';

//components
import ActionRiskDisplay from '@/components/ui/ActionRiskDisplay';
import AIRiskDisplay from '@/components/ui/AIRiskDisplay';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

//types
import { InternalTransaction } from '@/apis';

interface Props {
  transaction: InternalTransaction;
}

export default function SubHeader(props: Props) {
  const { transaction } = props;

  return (
    <div className={s.root}>
      <Feature name="PULSE">
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
