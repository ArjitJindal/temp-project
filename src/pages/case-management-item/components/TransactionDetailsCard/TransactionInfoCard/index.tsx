import React from 'react';
import moment from 'moment';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { TransactionCaseManagement } from '@/apis';
import FingerprintLineIcon from '@/components/ui/icons/Remix/device/fingerprint-line.react.svg';
import TimerLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import PulseLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import FileLineIcon from '@/components/ui/icons/Remix/document/file-3-line.react.svg';
import LinkIcon from '@/components/ui/icons/Remix/business/links-line.react.svg';
import BuildingIcon from '@/components/ui/icons/Remix/buildings/building-4-line.react.svg';
import TransactionIcon from '@/components/ui/icons/transaction.react.svg';
import * as Form from '@/components/ui/Form';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';

interface Props {
  transaction: TransactionCaseManagement;
}

export default function TransactionInfoCard(props: Props) {
  const { transaction } = props;
  return (
    <Card.Root className={s.root}>
      <Card.Section>
        <div className={s.fields}>
          <Form.Layout.Label icon={<FingerprintLineIcon />} title={'Transaction ID'} />
          <Id to={makeUrl(`/transactions/item/:id`, { id: transaction.transactionId })}>
            {transaction.transactionId}
          </Id>
          <Form.Layout.Label icon={<TimerLineIcon />} title={'Transaction Time'} />
          <div>{moment(transaction.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT)}</div>
          <Form.Layout.Label icon={<PulseLineIcon />} title={'Rule action'} />
          <RuleActionStatus ruleAction={transaction.status} />
          <Form.Layout.Label icon={<TransactionIcon />} title={'Transaction Type'} />
          <TransactionTypeTag transactionType={transaction.type} />
          <Form.Layout.Label icon={<FileLineIcon />} title="Reference" />
          {transaction.reference ?? '-'}
          <Form.Layout.Label icon={<BuildingIcon />} title="Product Type" />
          {transaction.productType ?? '-'}
          <Form.Layout.Label icon={<LinkIcon />} title="Related Transactions" />
          {transaction.relatedTransactionIds
            ? transaction.relatedTransactionIds.map((transactionId) => {
                return (
                  <Id to={makeUrl(`/transactions/item/:id`, { id: transactionId })}>
                    {transactionId}
                  </Id>
                );
              })
            : '-'}
        </div>
      </Card.Section>
    </Card.Root>
  );
}
