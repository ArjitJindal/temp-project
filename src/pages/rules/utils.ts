import { Priority, RuleLabels, RuleNature } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { RuleInstanceMap, RulesMap } from '@/utils/rules';

export const RULE_ACTION_OPTIONS: { label: string; value: RuleAction }[] = [
  { label: 'Flag', value: 'FLAG' },
  { label: 'Suspend', value: 'SUSPEND' },
  { label: 'Block', value: 'BLOCK' },
];

export function getRuleInstanceDisplayId(ruleId: string, ruleInstanceId: string | undefined) {
  return `${ruleId} (${ruleInstanceId || 'N/A'})`;
}

export function ruleHeaderKeyToDescription(key: string) {
  const keyToDescription = {
    'rules-library': 'Create a transaction monitoring rule with a straight-forward 3 step process',
    'my-rules': 'List of all your rules. Activate/deactivate them in one click',
  };
  if (Object.hasOwn(keyToDescription, key)) {
    return keyToDescription[key];
  }
  return '';
}

export function getRuleInstanceDisplay(
  ruleId: string,
  ruleInstanceId: string | undefined,
  rules: RulesMap,
  ruleInstances: RuleInstanceMap,
) {
  return ruleInstances[ruleInstanceId as string]?.ruleNameAlias || rules[ruleId]?.name || ruleId;
}

export const RULE_NATURE_LABELS: { [key in RuleNature]: string } = {
  AML: 'AML',
  FRAUD: 'Fraud',
  SCREENING: 'Screening',
  CTF: 'CTF',
};

export const RULE_NATURE_VALUES: RuleNature[] = Object.keys(RULE_NATURE_LABELS) as RuleNature[];

export const RULE_NATURE_OPTIONS: { label: string; value: RuleNature }[] = RULE_NATURE_VALUES.map(
  (value) => ({ label: RULE_NATURE_LABELS[value], value }),
);

export const RULE_LABELS_OPTIONS: {
  [key in RuleNature]: { label: string; value: RuleLabels }[];
} = {
  AML: [
    { label: 'Unexpected behavior', value: 'UNEXPECTED_BEHAVIOR' },
    { label: 'Illicit gains check', value: 'ILLICIT_GAINS_CHECK' },
    { label: 'RFI trigger', value: 'RFI_TRIGGER' },
    { label: 'EDD trigger', value: 'EDD_TRIGGER' },
    { label: 'KYC trigger', value: 'KYC_TRIGGER' },
  ],
  FRAUD: [
    { label: 'Scam', value: 'SCAM' },
    { label: 'Abuse', value: 'ABUSE' },
    { label: 'Account takeover', value: 'ACCOUNT_TAKEOVER' },
    { label: 'Unexpected behavior', value: 'UNEXPECTED_BEHAVIOR' },
    { label: 'Dispute', value: 'DISPUTE' },
  ],
  SCREENING: [
    { label: 'Sanctions', value: 'SANCTIONS' },
    { label: 'Sanctions & PEP', value: 'SANCTIONS_PEP' },
    { label: 'Sanctions, PEP & Adverse media', value: 'SANCTIONS_PEP_ADVERSE_MEDIA' },
  ],
  CTF: [
    { label: 'Unexpected behavior', value: 'UNEXPECTED_BEHAVIOR' },
    { label: 'Illicit gains check', value: 'ILLICIT_GAINS_CHECK' },
    { label: 'RFI trigger', value: 'RFI_TRIGGER' },
    { label: 'EDD trigger', value: 'EDD_TRIGGER' },
    { label: 'KYC trigger', value: 'KYC_TRIGGER' },
  ],
};

export const RULE_CASE_PRIORITY: { label: string; value: Priority }[] = [
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
  { label: 'P3', value: 'P3' },
  { label: 'P4', value: 'P4' },
];
