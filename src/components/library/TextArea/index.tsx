import { Input } from 'antd';
import { TextAreaRef } from 'antd/lib/input/TextArea';
import s from './styles.module.less';

export interface Props {
  value: string;
  onChange: (value: string) => void;
  showCount?: boolean;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  ref?: React.Ref<TextAreaRef>;
}

export default function TextArea(props: Props) {
  const { showCount, maxLength, value, onChange, rows, placeholder } = props;
  return (
    <Input.TextArea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      showCount={showCount}
      maxLength={maxLength}
      rows={rows}
      placeholder={placeholder}
      className={s.textArea}
      ref={props.ref}
    />
  );
}
