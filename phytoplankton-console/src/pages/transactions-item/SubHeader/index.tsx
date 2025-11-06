import React from 'react';

import s from './index.module.less';
import ActionRiskDisplay from '@/components/ui/ActionRiskDisplay';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import * as Form from '@/components/ui/Form';
import TransactionState from '@/components/ui/TransactionStateDisplay';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import TransactionTypeDisplay from '@/components/library/TransactionTypeDisplay';
import { InternalTransaction } from '@/apis';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { AsyncResource } from '@/utils/asyncResource';
import Skeleton from '@/components/library/Skeleton';

interface Props {
  transactionId: string;
  transactionRes: AsyncResource<InternalTransaction>;
}

export default function SubHeader(props: Props) {
  const { transactionId, transactionRes } = props;
  return (
    <div className={s.root}>
      <div className={s.attributes}>
        <Form.Layout.Label title="Created at" className={s.attribute}>
          <Skeleton res={transactionRes}>
            {(transaction) => dayjs(transaction.timestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title="State" className={s.attribute}>
          <Skeleton res={transactionRes}>
            {(transaction) => <TransactionState transactionState={transaction.transactionState} />}
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title="Rule action" className={s.attribute}>
          <Skeleton res={transactionRes}>
            {(transaction) =>
              transaction.status && <RuleActionStatus ruleAction={transaction.status} />
            }
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title="Type" className={s.attribute}>
          <Skeleton res={transactionRes}>
            {(transaction) => <TransactionTypeDisplay transactionType={transaction.type} />}
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title="Product Type" className={s.attribute}>
          <Skeleton res={transactionRes}>
            {(transaction) => transaction.productType ?? '-'}
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title="Source of funds" className={s.attribute}>
          <Skeleton res={transactionRes}>
            {(transaction) => transaction.originFundsInfo?.sourceOfFunds ?? '-'}
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title="Source of wealth" className={s.attribute}>
          <Skeleton res={transactionRes}>
            {(transaction) => transaction.originFundsInfo?.sourceOfWealth ?? '-'}
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title="Reference" className={s.attribute}>
          <Skeleton res={transactionRes}>{(transaction) => transaction.reference ?? '-'}</Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title="Jurisdiction" className={s.attribute}>
          <Skeleton res={transactionRes}>
            {(transaction) => transaction.jurisdiction ?? '-'}
          </Skeleton>
        </Form.Layout.Label>
      </div>
      <Feature name="RISK_SCORING">
        <div className={s.risks}>
          <ActionRiskDisplay transactionId={transactionId} />
        </div>
      </Feature>
    </div>
  );
}
