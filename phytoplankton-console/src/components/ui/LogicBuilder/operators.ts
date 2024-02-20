import { BasicConfig, Config, CoreOperators } from '@react-awesome-query-builder/ui';

const jsonLogicForBetween = (field, _op, values) => {
  const valFrom = values[0];
  const valTo = values[1];
  if (field.var.endsWith('time') && valFrom > valTo) {
    return {
      '!': {
        '<=': [valTo, field, valFrom],
      },
    };
  }
  return {
    '<=': [valFrom, field, valTo],
  };
};

const validateBetweenValues = (values) => {
  //For time
  if (
    typeof values[0] === 'string' &&
    typeof values[1] === 'string' &&
    isTimeValue(values[0]) &&
    isTimeValue(values[1])
  )
    return null;

  if (values[0] != undefined && values[1] != undefined) {
    return values[0] <= values[1] ? null : 'Invalid range';
  }
  return null;
};

const isTimeValue = (value: string) => {
  return value.split(':').length === 3;
};

export const JSON_LOGIC_OPERATORS: CoreOperators<Config> = {
  ...BasicConfig.operators,
  between: {
    ...BasicConfig.operators.between,
    jsonLogic: jsonLogicForBetween,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    validateValues: validateBetweenValues,
  },
  not_between: {
    ...BasicConfig.operators.not_between,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    validateValues: validateBetweenValues,
  },
};
