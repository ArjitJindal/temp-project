import React, { useMemo } from 'react';
import { UiSchemaFuzzinessSettings } from '../../../../types';
import { ShortNameAdjustmentInput } from '../ShortNameAdjustment';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';
import { FuzzinessSettingOptions } from '@/apis';
import Radio from '@/components/library/Radio';
import { FUZZINESS_SETTING_OPTIONSS } from '@/apis/models-custom/FuzzinessSettingOptions';
import Tooltip from '@/components/library/Tooltip';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

type ValueType = FuzzinessSettingOptions;

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaFuzzinessSettings;
}

const optionsMap: Record<FuzzinessSettingOptions, React.ReactNode> = {
  LEVENSHTEIN_DISTANCE_DEFAULT: (
    <span className={s.option}>
      Levenshtein distance
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
  JAROWINKLER_DISTANCE: (
    <span className={s.option}>
      Jaro-Winkler distance
      <Tooltip
        title={`Measures the similarity between two strings based on the Jaro-Winkler distance algorithm.`}
      >
        <InformationLineIcon className={s.icon} />
      </Tooltip>
    </span>
  ),
};

export const FuzzinessSettingsInput = (props: Props) => {
  const { value, onChange, ...rest } = props;
  const isAcurisEnabled = useFeatureEnabled('ACURIS');
  const isOpenSanctionsEnabled = useFeatureEnabled('OPEN_SANCTIONS');
  const useTokenizedDefault = isAcurisEnabled || isOpenSanctionsEnabled;
  const DEFAULT_VALUE = useTokenizedDefault
    ? 'TOKENIZED_SIMILARITY_MATCHING'
    : 'LEVENSHTEIN_DISTANCE_DEFAULT';

  const orderedOptions = useMemo(() => {
    let options = [...FUZZINESS_SETTING_OPTIONSS];
    // Always put the default value first
    const defaultIndex = options.indexOf(DEFAULT_VALUE);
    options = [
      DEFAULT_VALUE,
      ...options.slice(0, defaultIndex),
      ...options.slice(defaultIndex + 1),
    ];
    return options;
  }, [DEFAULT_VALUE]);

  const getOptionLabel = (option: FuzzinessSettingOptions) => {
    const optionContent = optionsMap[option];
    if (option === DEFAULT_VALUE) {
      return (
        <span className={s.option}>
          {optionContent}
          <span className={s.defaultLabel}> (default)</span>
        </span>
      );
    }
    return optionContent;
  };

  return (
    <>
      <div className={s.root}>
        {orderedOptions.map((option) => (
          <label key={option} className={s.item}>
            <div className={s.radio}>
              <Radio
                value={value === option}
                onChange={(checked) => {
                  if (checked) {
                    onChange?.(option);
                  }
                }}
                {...rest}
              />
            </div>
            <div className={s.text}>
              <div>{getOptionLabel(option)}</div>
            </div>
          </label>
        ))}
      </div>
      <ShortNameAdjustmentInput />
    </>
  );
};
