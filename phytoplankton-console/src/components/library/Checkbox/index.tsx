import { useRef } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import SubtractFillIcon from '@/components/ui/icons/Remix/system/subtract-fill.react.svg';
import { InputProps } from '@/components/library/Form';

type Sizes = 'S' | 'M' | 'L';

interface Props extends InputProps<boolean> {
  size?: Sizes;
  testName?: string;
  extraLeftLabelMargin?: boolean;
  className?: string;
}

export default function Checkbox(props: Props) {
  const {
    size = 'M',
    isDisabled,
    value,
    onChange,
    isError: _isError,
    testName,
    className,
    ...rest
  } = props;
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cn(s.root, s[`size-${size}`], className)}>
      <input
        ref={ref}
        className={s.input}
        type="checkbox"
        disabled={isDisabled}
        checked={value || false}
        onChange={(e) => {
          onChange?.(e.target.checked);
        }}
        data-cy={`${testName}-checkbox`}
        {...rest}
      />
      <div className={cn(s.content, value === undefined && s.isIndeterminate)}>
        <SubtractFillIcon className={cn(s.indeterminateIcon, value === undefined && s.isVisible)} />
        <CheckLineIcon className={s.icon} />
      </div>
    </div>
  );
}
