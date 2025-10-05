import { useCallback, useMemo, useState } from 'react';
import { useDebounce } from 'ahooks';
import { DefaultOptionType } from 'antd/es/select';
import { COUNTRIES, COUNTRY_ALIASES } from '@flagright/lib/constants';
import { Metadata } from '../../helpers';
import Select, { Option } from '@/components/library/Select';
import { AllUsersTableItemPreview, ListSubtypeInternal, TransactionsUniquesField } from '@/apis';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import UserSearchPopup from '@/pages/transactions/components/UserSearchPopup';
import { QueryResult } from '@/utils/queries/types';
import { getOr, isLoading } from '@/utils/asyncResource';
import { useTransactionsUniques } from '@/hooks/api/transactions';
import { neverThrow } from '@/utils/lang';
import { InputProps } from '@/components/library/Form';
import Spinner from '@/components/library/Spinner';
import { UserSearchParams } from '@/pages/users/users-list';

interface Props extends InputProps<string[]> {
  onChangeMeta?: (meta: Metadata) => void;
  listSubtype: ListSubtypeInternal;
  excludeCountries?: Set<string>;
  handleChangeParams?: (params: UserSearchParams) => void;
  params?: UserSearchParams;
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
    return <Select<string> mode="MULTIPLE" allowNewOptions options={[]} {...rest} />;
  }

  if (is314aEnabled && (listSubtype === '314A_INDIVIDUAL' || listSubtype === '314A_BUSINESS')) {
    return <SearchInput listSubtype={listSubtype} {...rest} />;
  }

  return <SearchInput listSubtype={listSubtype} {...rest} />;
}

function UserIdInput(props: Omit<Props, 'listSubtype'>) {
  const settings = useSettings();
  const { onChange, onChangeMeta, params, handleChangeParams } = props;
  const [newUserData, setNewUserData] = useState<{
    userId: string | null;
    userFullName: string;
  }>({
    userId: null,
    userFullName: '',
  });

  const handleChooseUser = useCallback(
    (user: AllUsersTableItemPreview) => {
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
      params={params}
      handleChangeParams={handleChangeParams}
      filterType="name"
    >
      <Button style={{ width: '100%' }}>
        {newUserData.userFullName || `Choose ${settings.userAlias}`}
      </Button>
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

  const uniquesRes = useTransactionsUniques(field, { filter: debouncedSearch });
  const queryResult: QueryResult<DefaultOptionType[]> = {
    data: uniquesRes.data as any,
    refetch: uniquesRes.refetch,
  } as any;
  return (
    <Select
      onSearch={setSearch}
      notFoundContent={isLoading(queryResult.data) ? <Spinner size="SMALL" /> : null}
      options={getOr(queryResult.data, []).map((option) => ({
        value: String(option.value || ''),
        label: option.label,
      }))}
      isLoading={isLoading(queryResult.data)}
      mode="MULTIPLE"
      allowNewOptions
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
      {...restProps}
    />
  );
}
