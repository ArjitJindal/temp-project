import React, { useEffect } from 'react';
import { UiSchemaFuzzinessSettings } from '../../../../types';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';
import { FuzzinessSettingOptions } from '@/apis';
import Radio from '@/components/library/Radio';
import { FUZZINESS_SETTING_OPTIONSS } from '@/apis/models-custom/FuzzinessSettingOptions';
import Tooltip from '@/components/library/Tooltip';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';

type ValueType = FuzzinessSettingOptions;

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaFuzzinessSettings;
}

const optionsMap: Record<FuzzinessSettingOptions, React.ReactNode> = {
  LEVENSHTEIN_DISTANCE_DEFAULT: (
    <span className={s.option}>
      Levenshtein distance (default)
      <Tooltip
        title={`Measures the minimum number of edits (insertions, deletions, or substitutions) needed to transform one term into another.`}
      >
        <InformationLineIcon className={s.icon} />
      </Tooltip>
    </span>
  ),
  IGNORE_SPACES_AND_SPECIAL_CHARACTERS: (
    <span className={s.option}>
      Ignore spaces and special characters
      <Tooltip
        title={`Computes fuzziness while disregarding spaces and special characters, focusing only on alphanumeric content.`}
      >
        <InformationLineIcon className={s.icon} />
      </Tooltip>
    </span>
  ),
  TOKENIZED_SIMILARITY_MATCHING: (
    <span className={s.option}>
      Tokenized similarity matching
      <Tooltip
        title={`Breaks text into individual terms (tokens), finds the most similar matches, calculates fuzziness for each, and then combines the values for a comprehensive similarity score. For example, calculating fuzziness between 'John Deo' and 'Deo John', John is compared to John and Deo is compared to Deo.`}
      >
        <InformationLineIcon className={s.icon} />
      </Tooltip>
    </span>
  ),
};

export const FuzzinessSettingsInput = (props: Props) => {
  const { value, onChange, ...rest } = props;
  useEffect(() => {
    if (!value && onChange) {
      onChange?.('LEVENSHTEIN_DISTANCE_DEFAULT');
    }
  }, [value, onChange]);
  return (
    <div className={s.root}>
      {FUZZINESS_SETTING_OPTIONSS.map((option) => (
        <label key={option} className={s.item}>
          <div className={s.radio}>
            <Radio
              value={(value ?? 'LEVENSHTEIN_DISTANCE_DEFAULT') === option}
              onChange={(checked) => {
                if (checked) {
                  onChange?.(option);
                }
              }}
              {...rest}
            />
          </div>
          <div className={s.text}>
            <div>{optionsMap[option]}</div>
          </div>
        </label>
      ))}
    </div>
  );
};
