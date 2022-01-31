export type RuleAction = 'flag' | 'block' | 'allow';

export type ThresholdAllowedDataTypes = 'string' | 'list' | 'number';

//type this better lol
export const actionToColor = {
  flag: 'orange',
  block: 'red',
  allow: 'green',
};

export type ThresholdDataType = {
  parameter: string;
  type: ThresholdAllowedDataTypes;
  defaultValue: string;
};

export type RuleTableListItemBase = {
  key: number;
  name: string;
  ruleDescription: string;
  ruleTemplateId: string;
  status: string;
  thresholdData: ThresholdDataType[];
};

export type RuleTemplateTableListItem = RuleTableListItemBase & {
  defaultRuleAction: RuleAction;
  isActionEditable: boolean;
};

export type RuleTableListItem = RuleTableListItemBase & {
  ruleAction: RuleAction;
  activatedAt: number;
  hitRate: number;
};
