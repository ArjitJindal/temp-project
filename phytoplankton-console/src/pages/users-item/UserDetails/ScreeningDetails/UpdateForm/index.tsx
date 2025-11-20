import { useMemo } from 'react';
import cn from 'clsx';
import { expandPEPStatus, validatePEPStatus } from '../PepStatus/utils';
import { PepFormValues, PepStatusForm } from '../PepStatus';
import s from './index.module.less';
import { PEPStatus, ScreeningDetails } from '@/apis';
import Label from '@/components/library/Label';
import { ModalWidth, isModalWidthGreatherThan } from '@/components/library/Modal';
import Select from '@/components/library/Select';
import Alert from '@/components/library/Alert';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import Spinner from '@/components/library/Spinner';

interface ScreeningDetailsUpdateFormProps {
  extraClassName?: string;
  size: ModalWidth | undefined;
  showDeleteIcon?: boolean;
  addFormAtTop?: boolean;
  updatePepValidationResult?: (result: string | null) => void;
  isLoading?: boolean;
}

export interface ScreeningDetailsValue {
  isSanctions: boolean;
  isAdverseMedia: boolean;
  pepDetails: PEPStatus[];
}

export const ScreeningDetailsUpdateForm = (props: ScreeningDetailsUpdateFormProps) => {
  const {
    updatePepValidationResult,
    size,
    extraClassName,
    showDeleteIcon = false,
    addFormAtTop = false,
    isLoading = false,
  } = props;

  const { values, setValues } = useFormContext<ScreeningDetails>();

  const setSanctionDetails = (value?: string) => {
    setValues((prev) => ({
      ...prev,
      sanctionsStatus: value === '' || !value ? undefined : value === 'Yes' ? true : false,
    }));
  };

  const setAdverseMediaDetails = (value?: string) => {
    setValues((prev) => ({
      ...prev,
      adverseMediaStatus: value === '' || !value ? undefined : value === 'Yes' ? true : false,
    }));
  };

  const setPepDetails = (value: PEPStatus[]) => {
    setValues((prev) => ({ ...prev, pepStatus: value }));
  };

  const handleChange = (index: number, pepValue: PepFormValues) => {
    pepValue = { ...pepValue, isPepHit: pepValue.isPepHit ?? false };
    const oldPepStatus = values.pepStatus ?? [];
    const newPepStatus = oldPepStatus.map((value, i) =>
      i === index ? pepValue : value,
    ) as PEPStatus[];
    setPepDetails(newPepStatus);
  };

  const handleDelete = (index: number) => {
    const newValue = values.pepStatus?.filter((_, i) => i !== index);
    if (newValue) {
      setPepDetails(newValue);
    }
  };

  const addNewPepField = () => {
    const oldPepStatus = values.pepStatus ?? [];
    const newPepStatus = addFormAtTop
      ? [{} as PEPStatus, ...oldPepStatus]
      : [...oldPepStatus, {} as PEPStatus];
    setPepDetails(newPepStatus);
  };

  const pepStatusToUpdate = useMemo(() => {
    const pepStatus = values.pepStatus ?? [];
    const sanitizedPepStatus = addFormAtTop ? pepStatus.slice(1) : pepStatus.slice(-1);
    return expandPEPStatus(sanitizedPepStatus as PepFormValues[]);
  }, [values.pepStatus, addFormAtTop]);

  const pepValidationResult = useMemo(() => {
    const result = validatePEPStatus(pepStatusToUpdate);
    if (updatePepValidationResult) {
      updatePepValidationResult(result);
    }
    return result;
  }, [pepStatusToUpdate, updatePepValidationResult]);

  return !isLoading ? (
    <div className={cn(s.form, extraClassName)}>
      <div className={s.flexDisplay}>
        <Label label="Sanction Status">
          <Select<string>
            value={
              values.sanctionsStatus === undefined
                ? ''
                : values.sanctionsStatus === true
                ? 'Yes'
                : 'No'
            }
            onChange={(value) => {
              setSanctionDetails(value);
            }}
            options={[
              { label: 'Yes', value: 'Yes' },
              { label: 'No', value: 'No' },
            ]}
          />
        </Label>
        <Label label="Adverse media status">
          <Select<string>
            value={
              values.adverseMediaStatus === undefined
                ? ''
                : values.adverseMediaStatus === true
                ? 'Yes'
                : 'No'
            }
            onChange={(value) => {
              setAdverseMediaDetails(value);
            }}
            options={[
              { label: 'Yes', value: 'Yes' },
              { label: 'No', value: 'No' },
            ]}
          />
        </Label>
      </div>
      {values.pepStatus?.map((value, index) => (
        <PepStatusForm
          key={index}
          values={value as PepFormValues}
          onChange={(value) => handleChange(index, value)}
          onDelete={() => handleDelete(index)}
          addNewPepField={() => addNewPepField()}
          isAddForm={index === (addFormAtTop ? 0 : (values?.pepStatus?.length ?? 0) - 1)}
          showDeleteIcon={showDeleteIcon}
          labelClassName={
            isModalWidthGreatherThan(size ?? 'M', 'M') ? s.labelFlexGrowTwo : s.flexNone
          }
        />
      ))}
      {pepValidationResult !== null && <Alert type="ERROR">{pepValidationResult}</Alert>}
    </div>
  ) : (
    <Spinner />
  );
};
