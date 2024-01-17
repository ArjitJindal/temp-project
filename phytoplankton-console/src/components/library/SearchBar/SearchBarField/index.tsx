import cn from 'clsx';
import s from './index.module.less';
import BrainIcon from '@/components/ui/icons/brain-icon-colored.react.svg';
import EqualizerLineIcon from '@/components/ui/icons/Remix/media/equalizer-line.react.svg';
import CloseIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';
import { InputProps } from '@/components/library/Form';

interface Props extends InputProps<string> {
  isExpanded?: boolean;
  onToggleFilters?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  onSearch?: (newValue: string | undefined) => void;
  onEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function SearchBarField(props: Props) {
  const { value, onChange, placeholder, onFocus, onBlur, onToggleFilters, onEnter } = props;

  return (
    <div className={s.root}>
      <BrainIcon className={s.icon} />
      <input
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
        {value && (
          <CloseIcon
            className={cn(s.icon, s.rightIcon)}
            onClick={() => {
              onChange?.('');
            }}
          />
        )}
        {onToggleFilters && (
          <EqualizerLineIcon className={cn(s.icon, s.rightIcon)} onClick={onToggleFilters} />
        )}
      </div>
    </div>
  );
}
