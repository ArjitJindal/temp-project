import { useMemo } from 'react';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import { useRuleQueues } from '@/hooks/api';

export function RuleQueueInputField<FormValues extends { queueId?: string }>(props: {
  label?: string;
}) {
  const ruleQueues = useRuleQueues();
  const options = useMemo(() => {
    return ruleQueues.map((queue) => ({
      label: queue.name,
      value: queue.id,
    }));
  }, [ruleQueues]);

  return (
    <InputField<FormValues, 'queueId'> name="queueId" label={props.label ?? 'Queue'}>
      {(inputProps) => (
        <Select
          {...inputProps}
          value={options.length ? inputProps.value : undefined}
          options={options}
          mode="SINGLE"
          placeholder="Select queue"
        />
      )}
    </InputField>
  );
}
