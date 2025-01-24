import React, { useImperativeHandle, useRef, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import Label from '@/components/library/Label';
import Select, { Option as SelectOption } from '@/components/library/Select';

export type Option = SelectOption<string> & {
  children?: Option[];
};

export interface RefType {
  reset: (valueToSet?: string) => void;
}

export interface Props {
  value?: string;
  onChange?: (newValue?: string) => void;
  label: React.ReactNode;
  options: Option[];
  testId?: string;
  isDisabled?: boolean;
}

// Check if current key is in current option or it's children has current option
const calcLocalValue = (value: string | undefined, options: Option[]) => {
  function checkOption(option: Option) {
    return option.value === value || option.children?.some(checkOption);
  }
  return options.find(checkOption)?.value ?? undefined;
};

function NestedSelects(props: Props, ref?: React.Ref<RefType>) {
  const { value, onChange, label, options, testId, isDisabled } = props;

  const [localValue, setLocalValue] = useState<string | undefined>(() => {
    return calcLocalValue(value, options);
  });
  const childRef = useRef<RefType>(null);

  useImperativeHandle(
    ref,
    () => ({
      reset: (valueToSet?: string) => {
        setLocalValue(calcLocalValue(valueToSet ?? value, options));
        childRef.current?.reset(valueToSet);
      },
    }),
    [value, options],
  );

  const selectedOption = options.find((x) => x.value === localValue);
  const handleSelect = (newValue?: string) => {
    setLocalValue(newValue);
    const newSelectedOption = options.find((x) => x.value === newValue);
    childRef?.current?.reset();
    const isLeaf = newSelectedOption != null && (newSelectedOption?.children?.length ?? 0) === 0;
    if (isLeaf) {
      onChange?.(newValue);
    } else if (value !== undefined) {
      onChange?.(undefined);
    }
  };
  return (
    <>
      <Label label={label} required={{ value: true, showHint: true }}>
        <Select<string>
          value={localValue}
          onChange={handleSelect}
          mode="SINGLE"
          portaled={true}
          options={options}
          testId={testId}
          placeholder={'Select an option'}
          isDisabled={isDisabled}
        />
      </Label>
      {selectedOption && (selectedOption?.children?.length ?? 0) !== 0 && (
        <NestedSelectsWithRef
          ref={childRef}
          value={value}
          onChange={onChange}
          label={
            typeof selectedOption.label === 'string'
              ? firstLetterUpper(selectedOption.label)
              : selectedOption.label
          }
          options={selectedOption.children ?? []}
          isDisabled={isDisabled}
        />
      )}
    </>
  );
}

const NestedSelectsWithRef = React.forwardRef<RefType, Props>(NestedSelects);
export default NestedSelectsWithRef;
