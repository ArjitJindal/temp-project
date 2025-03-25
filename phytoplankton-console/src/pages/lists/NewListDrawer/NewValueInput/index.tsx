import React, { useCallback, useMemo, useState } from 'react';
import { Select as AntSelect } from 'antd';
import { useDebounce } from 'ahooks';
import { DefaultOptionType } from 'antd/es/select';
import { COUNTRIES, COUNTRY_ALIASES } from '@flagright/lib/constants';
import { Metadata } from '../../helpers';
import s from './index.module.less';
import { AllUsersTableItem, ListSubtype, TransactionsUniquesField } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import UserSearchPopup from '@/pages/transactions/components/UserSearchPopup';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { QueryResult } from '@/utils/queries/types';
import { getOr, isLoading } from '@/utils/asyncResource';
import { TRANSACTIONS_UNIQUES } from '@/utils/queries/keys';
import { neverThrow } from '@/utils/lang';
import { InputProps } from '@/components/library/Form';
import Spinner from '@/components/library/Spinner';
import Select, { Option } from '@/components/library/Select';

interface Props extends InputProps<string[]> {
  onChangeMeta?: (meta: Metadata) => void;
  listSubtype: ListSubtype;
}

export default function NewValueInput(props: Props) {
  const { listSubtype, ...rest } = props;
  const is314aEnabled = useFeatureEnabled('314A');

  if (listSubtype === 'USER_ID') {
    return <UserIdInput {...rest} />;
  }

  if (listSubtype === 'COUNTRY') {
    return <CountriesInput {...rest} />;
  }

  if (listSubtype === 'STRING') {
    return <Select<string> className={s.select} mode={'TAGS'} options={[]} {...rest} />;
  }

  if (
    is314aEnabled &&
    (listSubtype === ('INDIVIDUAL_314' as ListSubtype) ||
      listSubtype === ('BUSINESS_314' as ListSubtype))
  ) {
    return <SearchInput listSubtype={listSubtype} {...rest} />;
  }

  return <SearchInput listSubtype={listSubtype} {...rest} />;
}

function UserIdInput(props: Omit<Props, 'listSubtype'>) {
  const { onChange, onChangeMeta } = props;
  const [newUserData, setNewUserData] = useState<{
    userId: string | null;
    userFullName: string;
  }>({
    userId: null,
    userFullName: '',
  });

  const handleChooseUser = useCallback(
    (user: AllUsersTableItem) => {
      setNewUserData((state) => ({
        ...state,
        userId: user.userId,
        userFullName: user.name ?? '',
      }));
      onChange?.([user.userId]);
      onChangeMeta?.({ userFullName: user.name ?? '' });
    },
    [onChangeMeta, onChange],
  );

  return (
    <UserSearchPopup
      initialSearch={''}
      onConfirm={handleChooseUser}
      placement="top"
      onEnterInput={(userId: string) => {
        onChange?.([userId]);
      }}
    >
      <Button style={{ width: '100%' }}>{newUserData.userFullName || 'Choose user'}</Button>
    </UserSearchPopup>
  );
}

const SEPARATOR = ',';

function SearchInput(
  props: Omit<Props, 'listSubtype'> & {
    listSubtype: Exclude<ListSubtype, 'USER_ID'>;
  },
) {
  const { listSubtype, value, onChange } = props;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, { wait: 500 });
  const api = useApi();
  const field: TransactionsUniquesField = useMemo((): TransactionsUniquesField => {
    switch (listSubtype) {
      case 'CARD_FINGERPRINT_NUMBER':
        return 'CARD_FINGERPRINT_NUMBER';
      case 'IBAN_NUMBER':
        return 'IBAN_NUMBER';
      case 'BANK_ACCOUNT_NUMBER':
        return 'BANK_ACCOUNT_NUMBER';
      case 'ACH_ACCOUNT_NUMBER':
        return 'ACH_ACCOUNT_NUMBER';
      case 'SWIFT_ACCOUNT_NUMBER':
        return 'SWIFT_ACCOUNT_NUMBER';
      case 'BIC':
        return 'BIC';
      case 'BANK_SWIFT_CODE':
        return 'SWIFT_ACCOUNT_NUMBER';
      case 'UPI_IDENTIFYING_NUMBER':
        return 'UPI_IDENTIFYING_NUMBER';
      case 'IP_ADDRESS':
        return 'IP_ADDRESS';
      case 'DEVICE_IDENTIFIER':
        return 'DEVICE_IDENTIFIER';
      case 'INDIVIDUAL_314' as ListSubtype:
        return '314A_INDIVIDUAL';
      case 'BUSINESS_314' as ListSubtype:
        return '314A_BUSINESS';
      case 'STRING':
      case 'COUNTRY':
        throw new Error(`This value is not supported: ${listSubtype}`);
      default:
        throw neverThrow(listSubtype, `Unsupported type: ${listSubtype}`);
    }
  }, [listSubtype]);

  const queryResult: QueryResult<DefaultOptionType[]> = useQuery(
    [TRANSACTIONS_UNIQUES(field, { filter: debouncedSearch }), debouncedSearch],
    async (): Promise<DefaultOptionType[]> => {
      if (debouncedSearch.length < 3) {
        return [];
      }
      const uniques = await api.getTransactionsUniques({
        field,
        filter: debouncedSearch,
      });
      return uniques.map((value) => ({ value: value, label: value }));
    },
  );
  return (
    <AntSelect<string[]>
      className={s.select}
      showSearch
      filterOption={false}
      onSearch={setSearch}
      notFoundContent={isLoading(queryResult.data) ? <Spinner size="SMALL" /> : null}
      options={getOr(queryResult.data, [])}
      loading={isLoading(queryResult.data)}
      tokenSeparators={[SEPARATOR]}
      mode="tags"
      value={value}
      onChange={(value) => {
        onChange?.(value);
      }}
    />
  );
}

const OPTIONS = Object.entries(COUNTRIES).map(
  (entry): Option<string> => ({
    value: entry[0],
    label: entry[1],
    alternativeLabels: COUNTRY_ALIASES[entry[0]] ?? [],
  }),
);

function CountriesInput(props: InputProps<string[]>) {
  return (
    <Select
      mode={'MULTIPLE'}
      options={OPTIONS}
      placeholder={`Select countries`}
      className={s.select}
      {...props}
    />
  );
}
