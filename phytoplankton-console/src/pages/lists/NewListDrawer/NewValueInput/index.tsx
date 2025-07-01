import React, { useCallback, useMemo, useState } from 'react';
import { useDebounce } from 'ahooks';
import { DefaultOptionType } from 'antd/es/select';
import { COUNTRIES, COUNTRY_ALIASES } from '@flagright/lib/constants';
import { Metadata } from '../../helpers';
import s from './index.module.less';
import Select, { Option } from '@/components/library/Select';
import { AllUsersTableItem, ListSubtypeInternal, TransactionsUniquesField } from '@/apis';
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

interface Props extends InputProps<string[]> {
  onChangeMeta?: (meta: Metadata) => void;
  listSubtype: ListSubtypeInternal;
  excludeCountries?: Set<string>;
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

  if (listSubtype === 'STRING' || listSubtype === 'CUSTOM') {
    return <Select<string> className={s.select} mode={'TAGS'} options={[]} {...rest} />;
  }

  if (is314aEnabled && (listSubtype === '314A_INDIVIDUAL' || listSubtype === '314A_BUSINESS')) {
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

function SearchInput(
  props: Omit<Props, 'listSubtype'> & {
    listSubtype: Exclude<ListSubtypeInternal, 'USER_ID'>;
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
      case '314A_INDIVIDUAL':
        return '314A_INDIVIDUAL';
      case '314A_BUSINESS':
        return '314A_BUSINESS';
      case 'STRING':
      case 'COUNTRY':
      case 'CUSTOM':
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
    <Select
      className={s.select}
      isSearchable
      onSearch={setSearch}
      notFoundContent={isLoading(queryResult.data) ? <Spinner size="SMALL" /> : null}
      options={getOr(queryResult.data, []).map((option) => ({
        value: String(option.value || ''),
        label: option.label,
      }))}
      isLoading={isLoading(queryResult.data)}
      mode="TAGS"
      value={value}
      onChange={(newValue) => {
        onChange?.(newValue ?? []);
      }}
    />
  );
}

const ALL_COUNTRY_OPTIONS = Object.entries(COUNTRIES).map(
  (entry): Option<string> => ({
    value: entry[0],
    label: entry[1],
    alternativeLabels: COUNTRY_ALIASES[entry[0]] ?? [],
  }),
);

function CountriesInput(props: InputProps<string[]> & { excludeCountries?: Set<string> }) {
  const { excludeCountries, ...restProps } = props;

  const filteredOptions = useMemo(() => {
    if (!excludeCountries || excludeCountries.size === 0) {
      return ALL_COUNTRY_OPTIONS;
    }
    return ALL_COUNTRY_OPTIONS.filter((option) => !excludeCountries.has(option.value));
  }, [excludeCountries]);

  return (
    <Select
      mode={'MULTIPLE'}
      options={filteredOptions}
      placeholder={`Select countries`}
      className={s.select}
      {...restProps}
    />
  );
}
