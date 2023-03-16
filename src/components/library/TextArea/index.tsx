import { Input } from 'antd';

export interface Props {
  value: string;
  onChange: (value: string) => void;
  showCount?: boolean;
  maxLength?: number;
}

export default function TextArea(props: Props) {
  const { showCount, maxLength, value, onChange } = props;
  return (
    <Input.TextArea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      showCount={showCount}
      maxLength={maxLength}
    />
  );
}
