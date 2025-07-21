import cn from 'clsx';
import { Option } from '../..';
import s from './index.module.less';
import MenuItemContainer from './MenuItemContainer';
import { Comparable, key } from '@/utils/comparable';
import CheckIcon from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import Checkbox from '@/components/library/Checkbox';

type OptionGroup<Value extends Comparable = string> = {
  kind: 'GROUP';
  label: string;
  options: Option<Value>[];
};

export type OptionOrGroup<Value extends Comparable = string> = Option<Value> | OptionGroup<Value>;

type Props<Value extends Comparable = string> = {
  showCheckboxes: boolean;
  optionOrGroup: OptionOrGroup<Value>;
  selectedValues: Value[];
  onSelectOption: (value: Value, option: Option<Value>) => void;
};

export default function MenuItem<Value extends Comparable = string>(props: Props<Value>) {
  const { showCheckboxes, optionOrGroup, selectedValues, onSelectOption } = props;
  if ('kind' in optionOrGroup && optionOrGroup.kind === 'GROUP') {
    return (
      <OptionGroup
        group={optionOrGroup}
        selectedValues={selectedValues}
        onSelectOption={onSelectOption}
        showCheckboxes={showCheckboxes}
      />
    );
  }
  const option = optionOrGroup as Option<Value>;
  const isSelected = selectedValues.includes(option.value);
  return (
    <OptionItem
      showCheckbox={showCheckboxes}
      option={option}
      isSelected={isSelected}
      onClick={() => {
        onSelectOption(option.value, option);
      }}
    />
  );
}

/*  
  Helper components
*/
function OptionItem<Value extends Comparable = string>(props: {
  showCheckbox?: boolean;
  option: Option<Value>;
  isNested?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  return (
    <MenuItemContainer
      isInteractive={true}
      isDisabled={props.option.isDisabled}
      isNested={props.isNested}
      isSelected={props.isSelected}
      onClick={props.onClick}
    >
      <div className={cn(s.option, { [s.isSelected]: props.isSelected })}>
        {props.showCheckbox && (
          <Checkbox size="S" value={props.isSelected} isDisabled={props.option.isDisabled} />
        )}
        {props.option.icon && <div className={s.optionIcon}>{props.option.icon}</div>}
        <div className={s.optionLabel}>
          {props.option.label || props.option.labelText || props.option.value}
        </div>
        <CheckIcon className={s.optionCheckIcon} />
      </div>
    </MenuItemContainer>
  );
}

function OptionGroup<Value extends Comparable = string>(props: {
  group: OptionGroup<Value>;
  selectedValues: Value[];
  onSelectOption: (value: Value, option: Option<Value>) => void;
  showCheckboxes: boolean;
}) {
  return (
    <>
      <MenuItemContainer>
        <div className={s.groupLabel}>{props.group.label}</div>
      </MenuItemContainer>
      {props.group.options.map((option) => {
        const isSelected = props.selectedValues.includes(option.value);
        return (
          <OptionItem
            key={key(option.value)}
            showCheckbox={props.showCheckboxes}
            option={option}
            isNested={true}
            isSelected={isSelected}
            onClick={() => {
              props.onSelectOption(option.value, option);
            }}
          />
        );
      })}
    </>
  );
}
