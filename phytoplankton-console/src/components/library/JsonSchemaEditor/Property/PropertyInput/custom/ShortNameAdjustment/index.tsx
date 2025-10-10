import React, { useEffect } from 'react';
import s from './style.module.less';
import { useFormState } from '@/components/library/Form/utils/hooks';
import { FuzzinessSettingOptions } from '@/apis';
import Checkbox from '@/components/library/Checkbox';
import Label from '@/components/library/Label';

interface FormValues {
  fuzzinessSetting: FuzzinessSettingOptions;
  [key: string]: any;
}

export const ShortNameAdjustmentInput = () => {
  const formState = useFormState<FormValues>();
  const { fuzzinessSetting } = formState.values;
  const { setValues } = formState;

  useEffect(() => {
    if (fuzzinessSetting === 'JAROWINKLER_DISTANCE' && formState.values.enableShortNameMatching) {
      setValues((prev) => ({
        ...prev,
        enableShortNameMatching: false,
      }));
    }
  }, [fuzzinessSetting, setValues, formState.values.enableShortNameMatching]);

  const handleChange = (value?: boolean) => {
    formState.setValues({
      ...formState.values,
      enableShortNameMatching: value,
    });
  };

  const shouldShow =
    formState.values?.fuzzinessSetting &&
    formState.values.fuzzinessSetting !== 'JAROWINKLER_DISTANCE';

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={s.root}>
      <Checkbox value={!!formState.values.enableShortNameMatching} onChange={handleChange} />
      <Label
        required={{ value: false, showHint: true }}
        label="Short name matching adjustment"
        hint="Ensures fair fuzzy matching for short names by allowing at least one mismatch when names are too short 
        for the configured fuzziness to permit any. The threshold is calculated as 1 ÷ fuzziness % (e.g., 15% → names ≤6 characters). 
        This improves accuracy for short or misspelled names."
      />
    </div>
  );
};
