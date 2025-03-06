import cn from 'clsx';
import { useMemo, useRef } from 'react';
import { isEmpty } from 'lodash';
import s from './index.module.less';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';
import BackIcon from '@/components/ui/icons/Remix/system/arrow-left-line.react.svg';
import EqualizerLineIcon from '@/components/ui/icons/Remix/media/equalizer-line.react.svg';
import SearchLineIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';
import CloseIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';
import { InputProps } from '@/components/library/Form';

interface Props<FilterParams extends object = object> extends InputProps<string> {
  isExpanded?: boolean;
  onToggleFilters?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  onSearch?: (newValue: string | undefined) => void;
  onEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  filterParams?: FilterParams;
  onClear: () => void;
  isAIEnabled: boolean;
  setIsAIEnabled?: (isAIEnabled: boolean) => void;
  onChangeFilterParams?: (filterParams: FilterParams) => void;
}

export default function SearchBarField<FilterParams extends object = object>(
  props: Props<FilterParams>,
) {
  const {
    value,
    onChange,
    placeholder,
    onFocus,
    onBlur,
    onToggleFilters,
    onEnter,
    filterParams,
    onClear,
    isAIEnabled,
    setIsAIEnabled,
    onChangeFilterParams,
  } = props;

  const isAllFiltersEmpty = useMemo(() => {
    if (!filterParams) {
      return true;
    }
    return Object.values(filterParams).every((value) => isEmpty(value));
  }, [filterParams]);

  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={s.root}>
      {isAIEnabled ? (
        <div className={s.icons}>
          {setIsAIEnabled && (
            <BackIcon
              className={cn(s.icon, s.leftIcon)}
              onClick={(e) => {
                e.stopPropagation();
                setIsAIEnabled(false);
                onChangeFilterParams?.({} as FilterParams);
              }}
            />
          )}
          <AiForensicsLogo />
        </div>
      ) : (
        <SearchLineIcon className={cn(s.icon, s.leftIcon)} />
      )}
      <input
        ref={inputRef}
        className={s.input}
        value={value ?? ''}
        onChange={(e) => {
          onChange?.(e.target?.value);
        }}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onEnter?.(e);
          }
        }}
      />
      <div className={s.icons}>
        {value || !isAllFiltersEmpty ? (
          <CloseIcon
            className={cn(s.icon, s.rightIcon)}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              inputRef.current?.focus();
            }}
          />
        ) : null}
        {onToggleFilters && (
          <EqualizerLineIcon className={cn(s.icon, s.rightIcon)} onClick={onToggleFilters} />
        )}
      </div>
    </div>
  );
}
