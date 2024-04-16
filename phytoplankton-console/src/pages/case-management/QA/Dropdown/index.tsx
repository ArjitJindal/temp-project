import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { TableSearchParams } from '../../types';
import { QAFormValues } from '../types';
import { QAModal } from '../Modal';
import { useAlertsSamplingCreateMutation } from '../utils';
import s from './style.module.less';
import Dropdown, { DropdownOption } from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { AllParams } from '@/components/library/Table/types';
import { useHasPermissions } from '@/utils/user-utils';
import { AlertQASamplingFilters } from '@/apis';

type OptionTypes = 'CREATE_SAMPLE' | 'VIEW_SAMPLE';

interface Props {
  params: AllParams<TableSearchParams>;
}

export const QAButton = (props: Props) => {
  const { params } = props;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const isQAWriteEnabled = useHasPermissions(['case-management:qa:write']);

  const options: DropdownOption<OptionTypes>[] = useMemo(() => {
    const options: DropdownOption<OptionTypes>[] = [
      ...(isQAWriteEnabled
        ? [{ value: 'CREATE_SAMPLE' as OptionTypes, label: 'Create sample' }]
        : []),
      { value: 'VIEW_SAMPLE', label: 'View samples' },
    ];

    return options;
  }, [isQAWriteEnabled]);

  const onSelect = useCallback(
    (option: DropdownOption<OptionTypes>) => {
      if (option.value === 'CREATE_SAMPLE') {
        setIsModalOpen(true);
      } else {
        navigate('/case-management/qa-sampling');
      }
    },
    [navigate],
  );

  const mutation = useAlertsSamplingCreateMutation(setIsModalOpen);

  const onSubmit = useCallback(
    async (values: QAFormValues) => {
      const filters: AlertQASamplingFilters = {
        alertClosedAt: {
          start: Number(params?.createdTimestamp?.[0] || 0),
          end: Number(params?.createdTimestamp?.[1] || Number.MAX_SAFE_INTEGER),
        },
        alertClosingReasons: params?.filterClosingReason,
        alertId: params?.alertId,
        assignedTo: params?.assignedTo,
        alertPriority: params?.alertPriority,
        caseTypes: params?.caseTypesFilter,
        qaAssignedTo: params?.qaAssignment,
        queueIds: params?.ruleQueueIds,
        ruleInstances: params?.rulesExecutedFilter,
        userId: params?.userId,
      };

      mutation.mutate({
        ...values,
        samplingData: {
          samplingType: 'AUTOMATIC',
          samplingPercentage: values.samplingPercentage,
          filters,
        },
      });
    },
    [params, mutation],
  );

  return (
    <>
      <Dropdown<OptionTypes> options={options} onSelect={onSelect}>
        {options.length > 0 && (
          <Button type="SECONDARY" testName="qa-sampling-dropdown">
            QA sampling
            <ArrowDownSLineIcon className={s.arrowIcon} />
          </Button>
        )}
      </Dropdown>
      <QAModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        onSubmit={onSubmit}
        type="CREATE"
        sampleType="AUTOMATIC"
      />
    </>
  );
};
