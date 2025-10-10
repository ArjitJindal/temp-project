import cn from 'clsx';
import s from './index.module.less';
import TextArea from '@/components/library/TextArea';

interface Props {
  value?: string;
  onBlur?: () => void;
  onChange?: (value: string | undefined) => void;
  isDisabled?: boolean;
}

export default function EditableComment(props: Props) {
  const { value, onBlur, onChange, isDisabled } = props;

  return (
    <div className={s.root}>
      <div className={s.comment}>{value}</div>
      <div className={cn(s.edit)}>
        <TextArea
          rows={1}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          isDisabled={isDisabled}
        />
      </div>
    </div>
  );
}
