export type RuleAction = 'flag' | 'block' | 'allow';

export type ThresholdDataType = {
  parameter: string;
  type: ThresholdAllowedDataTypes;
  defaultValue: string;
};

export type RuleItem = {
  key: number;
  disabled?: boolean;
  href: string;
  name: string;
  ruleDescription: string;
  ruleId: string;
  status: string;
  thresholdData: ThresholdDataType[];
  defaultRuleAction: RuleAction;
  isActionEditable: boolean;
};
