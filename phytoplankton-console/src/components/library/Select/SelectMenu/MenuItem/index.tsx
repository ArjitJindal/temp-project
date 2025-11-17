import cn from 'clsx';
import { Option } from '../..';
import s from './index.module.less';
import MenuItemContainer from './MenuItemContainer';
import { Comparable, key } from '@/utils/comparable';
import CheckIcon from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import Checkbox from '@/components/library/Checkbox';
import { getOptionLabelNode } from '@/components/library/Select/helpers';

type OptionGroup<Value extends Comparable = string> = {
  kind: 'GROUP';
  id: string;
  label: string;
  options: Option<Value>[];
};

export type OptionOrGroup<Value extends Comparable = string> = Option<Value> | OptionGroup<Value>;

type Props<Value extends Comparable = string> = {
  showCheckboxes: boolean;
  optionOrGroup: OptionOrGroup<Value>;
  highlightedOption?: Value | null;
  selectedValues: Value[];
  onSelectOption: (value: Value, option: Option<Value>) => void;
  onHoverOption?: (value: Value | null) => void;
};

export default function MenuItem<Value extends Comparable = string>(props: Props<Value>) {
  const { showCheckboxes, optionOrGroup, selectedValues, onSelectOption, onHoverOption } = props;
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
  const isHighlighted = props.highlightedOption === option.value;
  return (
    <OptionItem
      showCheckbox={showCheckboxes}
      option={option}
      isSelected={isSelected}
      isHighlighted={isHighlighted}
      onClick={() => {
        onSelectOption(option.value, option);
      }}
      onHoverOption={onHoverOption}
    />
  );
}

/*
  Helper components
*/
function OptionItem<Value extends Comparable = string>(props: {
  showCheckbox?: boolean;
  option: Option<Value>;
  onHoverOption?: (value: Value | null) => void;
  isNested?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const labelNode = getOptionLabelNode(props.option);
  let labelTitle = `${props.option.value}`;
  if (typeof props.option.labelText === 'string') {
    labelTitle = props.option.labelText;
  } else if (typeof props.option.label === 'string') {
    labelTitle = props.option.label;
  }
  return (
    <MenuItemContainer
      id={`menu-item-container-option-${props.option.value}`}
      isInteractive={true}
      isDisabled={props.option.isDisabled}
      isNested={props.isNested}
      isSelected={props.isSelected}
      isHighlighted={props.isHighlighted}
      onMouseLeave={() => {
        if (props.onHoverOption) {
          props.onHoverOption(null);
        }
      }}
      onMouseEnter={() => {
        if (props.onHoverOption) {
          props.onHoverOption(props.option.value);
        }
      }}
      onClick={props.onClick}
    >
      <div
        className={cn(s.option, { [s.isSelected]: props.isSelected })}
        data-cy={`menu-item-${props.option.value}`}
      >
        {props.showCheckbox && (
          <Checkbox size="S" value={props.isSelected} isDisabled={props.option.isDisabled} />
        )}
        {props.option.icon && <div className={s.optionIcon}>{props.option.icon}</div>}
        <div
          className={s.optionLabel}
          data-cy={`menu-item-label-${props.option.value}`}
          title={labelTitle}
        >
          {labelNode}
        </div>
        <CheckIcon className={s.optionCheckIcon} />
      </div>
    </MenuItemContainer>
  );
}

function OptionGroup<Value extends Comparable = string>(props: {
  highlightedOption?: Value;
  onHoverOption?: (value: Value | null) => void;
  group: OptionGroup<Value>;
  selectedValues: Value[];
  onSelectOption: (value: Value, option: Option<Value>) => void;
  showCheckboxes: boolean;
}) {
  return (
    <>
      <MenuItemContainer id={`menu-item-container-group-${props.group.id}`}>
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
            isHighlighted={props.highlightedOption === option.value}
            isSelected={isSelected}
            onHoverOption={props.onHoverOption}
            onClick={() => {
              props.onSelectOption(option.value, option);
            }}
          />
        );
      })}
    </>
  );
}
