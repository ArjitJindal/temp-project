import cn from 'clsx';
import s from './index.module.less';
import { Comparable, key } from '@/utils/comparable';
import { Option, TagRenderer } from '@/components/library/Select';

type Props<Value extends Comparable> = {
  isDisabled: boolean;
  selectedOptions: Option<Value>[];
  onRemove: (value: Value) => void;
  tagRenderer: TagRenderer<Value>;
};

export default function Tags<Value extends Comparable>(props: Props<Value>) {
  const { isDisabled, onRemove, tagRenderer, selectedOptions } = props;
  return (
    <>
      {selectedOptions.map((option) => (
        <div className={cn(s.tagWrapper, isDisabled && s.isDisabled)} key={key(option.value)}>
          {tagRenderer({
            isHovered: false,
            isShadowed: false,
            isOnTop: false,
            option,
            onRemove: () => onRemove(option.value),
          })}
        </div>
      ))}
    </>
  );
}
