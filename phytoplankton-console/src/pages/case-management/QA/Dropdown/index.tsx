import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { TableSearchParams } from '../../types';
import { QAFormValues } from '../types';
import { QAModal } from '../Modal';
import { useAlertsSamplingCreateMutation } from '../utils';
import { getAlertsQueryParams } from '../../utils';
import s from './style.module.less';
import Dropdown, { DropdownOption } from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { AllParams } from '@/components/library/Table/types';
import { useAuth0User, useHasResources } from '@/utils/user-utils';
import { DefaultApiGetAlertListRequest } from '@/apis/types/ObjectParamAPI';

type OptionTypes = 'CREATE_SAMPLE' | 'VIEW_SAMPLE';

interface Props {
  params: AllParams<TableSearchParams>;
}

export const QAButton = (props: Props) => {
  const { params } = props;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const isQAWriteEnabled = useHasResources(['write:::case-management/qa/*']);
  const user = useAuth0User();

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
      const filters: DefaultApiGetAlertListRequest = getAlertsQueryParams(params, user);

      mutation.mutate({
        ...values,
        samplingData: {
          samplingType: 'AUTOMATIC',
          samplingQuantity: values.samplingQuantity,
          filters,
        },
      });
    },
    [params, mutation, user],
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
        params={params}
      />
    </>
  );
};
