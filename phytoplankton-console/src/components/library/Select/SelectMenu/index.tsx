import { Option } from '..';
import s from './index.module.less';
import MenuItem, { OptionOrGroup } from './MenuItem';
import { Comparable, key } from '@/utils/comparable';

export interface Props<Value extends Comparable = string> {
  options: OptionOrGroup<Value>[];
  selectedValues: Value[];
  onSelectOption: (value: Value, option: Option<Value>) => void;
  showCheckboxes?: boolean;
}

export default function SelectMenu<Value extends Comparable = string>(props: Props<Value>) {
  return (
    <div className={s.root}>
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
        />
      ))}
    </div>
  );
}
