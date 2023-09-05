import { Input } from 'antd';
import { TextAreaRef } from 'antd/lib/input/TextArea';
import cn from 'clsx';
import s from './styles.module.less';
import { InputProps } from '@/components/library/Form';

export interface Props extends InputProps<string> {
  className?: string;
  showCount?: boolean;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  ref?: React.Ref<TextAreaRef>;
  minHeight?: string;
}

export default function TextArea(props: Props) {
  const {
    className,
    showCount,
    maxLength,
    value,
    onChange,
    rows,
    placeholder,
    isError: _isError, // todo: implement
    isDisabled,
    onFocus,
    onBlur,
    minHeight,
  } = props;
  return (
    <Input.TextArea
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      showCount={showCount}
      maxLength={maxLength}
      rows={rows}
      placeholder={placeholder}
      className={cn(s.textArea, className)}
      disabled={isDisabled}
      ref={props.ref}
      onFocus={onFocus ? () => onFocus() : undefined}
      onBlur={onBlur ? () => onBlur() : undefined}
      style={{ minHeight }}
    />
  );
}
