import React, { useEffect, useState } from 'react';
import { Input } from 'antd';
import { useDebounce } from 'ahooks';
import { BarcodeOutlined } from '@ant-design/icons';
import { useLastSearches, useTransactions } from '../helpers';
import s from './style.module.less';
import TransactionList from './TransactionList';
import LastSearchList from './LastSearchList';
import SearchLineIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';
import { isSuccess } from '@/utils/asyncResource';
import { Transaction } from '@/apis';

interface Props {
  initialSearch: string;
  isVisible: boolean;
  onConfirm: (transaction: Transaction) => void;
  onCancel: () => void;
}

export default function PopupContent(props: Props) {
  const { isVisible, initialSearch, onConfirm } = props;

  const [search, setSearch] = useState(initialSearch);

  const debouncedSearch = useDebounce(search, { wait: 500 });
  const transactionsRes = useTransactions(debouncedSearch);

  const { onAdd } = useLastSearches();

  const transactionsCount = isSuccess(transactionsRes.data)
    ? transactionsRes.data.value.total
    : null;

  useEffect(() => {
    if (!isVisible) {
      if (debouncedSearch !== '' && transactionsCount != null && transactionsCount > 0) {
        onAdd(debouncedSearch);
      }
    }
  }, [onAdd, isVisible, transactionsCount, debouncedSearch]);

  useEffect(() => {
    if (!isVisible) {
      setSearch(initialSearch);
    }
  }, [isVisible, initialSearch]);

  function handleSelectTransaction(transaction: Transaction) {
    onConfirm(transaction);
    onAdd(debouncedSearch);
    setSearch('');
  }

  // todo: i18n
  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>
          <BarcodeOutlined />
          <span>Find a Transaction</span>
        </div>
        <Input
          suffix={search === '' && <SearchLineIcon className={s.searchIcon} />}
          placeholder="Search by transaction ID"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          allowClear
        />
      </div>
      {search !== '' ? (
        <div className={s.content}>
          <TransactionList
            transactionRes={transactionsRes.data}
            selectedTransaction={null}
            search={debouncedSearch}
            onSelectTransaction={handleSelectTransaction}
          />
        </div>
      ) : (
        <div className={s.content}>
          <LastSearchList onSelect={setSearch} />
        </div>
      )}
    </div>
  );
}
