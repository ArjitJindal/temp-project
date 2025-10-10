import cn from 'clsx';
import s from './index.module.less';
import Checkbox from '@/components/library/Checkbox';
import ArrowSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import { InputProps } from '@/components/library/Form/types';
import Label from '@/components/library/Label';

interface Props extends Omit<InputProps<string[]>, 'onChange'> {
  onCheckboxChange: (key: string, checked: boolean) => void;
  expandedKeys: string[];
  indeterminateKeys: string[];
  options: { label: string; value: string; hasChildren?: boolean }[];
  onExpand?: (value: string) => void;
}

export default function CheckboxList(props: Props) {
  const {
    options,
    value = [],
    onCheckboxChange,
    onExpand,
    expandedKeys,
    indeterminateKeys,
  } = props;

  return (
    <div className={s.root}>
      <div className={s.scrollBody}>
        {options.map((option) => (
          <div
            key={option.value}
            className={cn(s.item, expandedKeys.includes(option.value) && s.isActive)}
          >
            <Label key={option.value} label={option.label} position="RIGHT" level={2}>
              <Checkbox
                value={
                  indeterminateKeys.includes(option.value)
                    ? undefined
                    : value.includes(option.value)
                }
                onChange={(checked) => {
                  onCheckboxChange(option.value, checked ?? false);
                }}
              />
            </Label>
            {option.hasChildren && (
              <ArrowSLineIcon className={s.icon} onClick={() => onExpand?.(option.value)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
