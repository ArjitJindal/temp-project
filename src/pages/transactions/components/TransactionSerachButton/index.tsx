import React, { useEffect, useState } from 'react';
import { BarcodeOutlined } from '@ant-design/icons';
import TransactionSearchPopup from '../TransactionSearchPopup';
import ActionButton from '@/components/ui/Table/ActionButton';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { Transaction } from '@/apis';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';

interface Props {
  transactionId: string | null;
  onConfirm: (transactionId: string | null) => void;
}

export default function TransactionSearchButton(props: Props) {
  const { transactionId, onConfirm } = props;
  const [transactionRest, setTransactionRest] = useState<AsyncResource<Transaction>>(init());
  const transaction = getOr(transactionRest, null);
  const currentTransactionId = transaction?.transactionId ?? null;
  const api = useApi();

  useEffect(() => {
    if (transactionId == null || transactionId === 'all') {
      setTransactionRest(init());
      return () => {};
    }
    if (transactionId === currentTransactionId) {
      return () => {};
    }

    let isCanceled = false;
    setTransactionRest(loading());
    Promise.all([api.getTransaction({ transactionId })])
      .then(([transaction]) => {
        if (isCanceled) {
          return;
        }
        setTransactionRest(success(transaction));
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        setTransactionRest(
          failed(`Unable to find transaction by id "${transactionId}". ${getErrorMessage(e)}`),
        );
      });
    return () => {
      isCanceled = true;
    };
  }, [api, transactionId, currentTransactionId]);

  return (
    <TransactionSearchPopup
      initialSearch={transactionId ?? ''}
      onConfirm={(transaction) => {
        setTransactionRest(success(transaction));
        onConfirm(transaction.transactionId);
      }}
    >
      <ActionButton
        color="SKY_BLUE"
        icon={<BarcodeOutlined />}
        analyticsName="transaction_search_button"
        isActive={transactionId != null}
        onClear={() => {
          onConfirm(null);
        }}
      >
        {transactionId || 'Find Transaction ID'}
      </ActionButton>
    </TransactionSearchPopup>
  );
}
