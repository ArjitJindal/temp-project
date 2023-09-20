import { QuestionVariable, QuestionVariableOption } from '@/apis';
import { VariablesValues } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemLayout/VariablesPopover';

// Transform variables for API requests:
// - Turn date strings into unix time
export const variablesToApi = (
  variables: VariablesValues,
  variableOptions: QuestionVariableOption[] = [],
): { name: string; value: any }[] => {
  return Object.entries(variables).map(([name, value]) => {
    const option = variableOptions?.find((vo) => vo.name === name);
    if (option?.variableType === 'DATETIME') {
      const noTimezone = value.indexOf('+') > -1 ? value.split('+')[0] : value;
      return { name, value: new Date(noTimezone).valueOf() };
    }

    return { name, value };
  });
};

// Transform variables from API response:
// - Turn unix time into date string
export const variablesFromApi = (
  variables: QuestionVariable[] = [],
  variableOptions: QuestionVariableOption[] = [],
): VariablesValues => {
  return (
    variables?.reduce<VariablesValues>((acc, v) => {
      const option = variableOptions?.find((vo) => vo.name === v.name);
      let value = v.value;
      if (option?.variableType === 'DATETIME') {
        value = new Date(value).toISOString();
      }
      acc[v.name] = value;
      return acc;
    }, {}) || {}
  );
};
