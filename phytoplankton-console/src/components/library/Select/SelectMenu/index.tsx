import { ForwardedRef, forwardRef, useImperativeHandle, useRef } from 'react';
import { Option } from '..';
import s from './index.module.less';
import MenuItem, { OptionOrGroup } from './MenuItem';
import { Comparable, key } from '@/utils/comparable';
import { useId } from '@/utils/hooks';

export type SelectMenuRef<Value extends Comparable> = {
  scrollToOption: (value: Value) => void;
};

export interface Props<Value extends Comparable = string> {
  highlightedOption?: Value | null;
  options: OptionOrGroup<Value>[];
  selectedValues: Value[];
  onSelectOption: (value: Value, option: Option<Value>) => void;
  onHoverOption?: (value: Value | null) => void;
  showCheckboxes?: boolean;
}

function SelectMenu<Value extends Comparable = string>(
  props: Props<Value>,
  ref: ForwardedRef<SelectMenuRef<Value>>,
) {
  const id = useId(`select-menu`);

  const rootRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => {
    return {
      scrollToOption: (value: Value): HTMLElement | null => {
        const option = props.options.find((optionOrGroup) => {
          if ('kind' in optionOrGroup && optionOrGroup.kind === 'GROUP') {
            return false;
          }
          return (optionOrGroup as Option<Value>).value === value;
        });
        if (option) {
          const el =
            (rootRef.current?.querySelector(
              `[data-cy="menu-item-container-option-${value}"]`,
            ) as HTMLElement) ?? null;
          if (el) {
            el.scrollIntoView({
              block: 'center',
            });
          }
        }
        return null;
      },
    };
  });

  return (
    <div className={s.root} ref={rootRef} data-cy={id}>
      {props.options.map((optionOrGroup: OptionOrGroup<Value>) => (
        <MenuItem
          key={
            'kind' in optionOrGroup && optionOrGroup.kind === 'GROUP'
              ? optionOrGroup.label
              : key((optionOrGroup as Option<Value>).value)
          }
          optionOrGroup={optionOrGroup}
          selectedValues={props.selectedValues}
          onSelectOption={props.onSelectOption}
          showCheckboxes={props.showCheckboxes ?? false}
          highlightedOption={props.highlightedOption}
          onHoverOption={props.onHoverOption}
        />
      ))}
    </div>
  );
}

export default forwardRef(SelectMenu) as <Value extends Comparable>(
  props: Props<Value> & { ref?: React.ForwardedRef<SelectMenuRef<Value> | undefined | null> },
) => JSX.Element;
