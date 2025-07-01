import { useRef } from 'react';
import cn from 'clsx';
import { InputProps } from '../Form';
import s from './style.module.less';
import CheckFillIcon from '@/components/ui/icons/Remix/system/check-fill.react.svg';
import CloseFillIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';

export type Sizes = 'S' | 'M';

interface Props extends InputProps<boolean> {
  size?: Sizes;
  green?: boolean;
  testId?: string;
}

export default function Toggle(props: Props) {
  const {
    value,
    onChange,
    size = 'M',
    isLoading,
    isDisabled,
    testId = 'anonymous-toggle',
    ...rest
  } = props;

  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className={cn(s.root, s[`size-${size}`])} data-cy={`${testId}-root`}>
      <input
        ref={ref}
        className={s.input}
        type="checkbox"
        disabled={isDisabled || isLoading}
        checked={value || false}
        onChange={(e) => {
          onChange?.(e.target.checked);
        }}
        data-cy={`${testId}`}
        {...rest}
      />
      <div className={s.content} data-cy={`${testId}-bg`}>
        <div className={s.circle}>
          <CheckFillIcon className={cn(s.icon, s.on)} />
          <CloseFillIcon className={cn(s.icon, s.off)} />
        </div>
      </div>
    </div>
  );
}
