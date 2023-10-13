import { useMutation } from '@tanstack/react-query';
import { RuleConfigurationFormValues } from './RuleConfigurationDrawer/RuleConfigurationForm';
import { useApi } from '@/api';
import { Priority, RuleInstance, RuleLabels, RuleNature, TriggersOnHit } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { removeEmpty } from '@/utils/json';
import { RuleInstanceMap, RulesMap } from '@/utils/rules';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { PRIORITYS } from '@/apis/models-custom/Priority';

export const RULE_ACTION_OPTIONS: { label: string; value: RuleAction }[] = [
  { label: 'Flag', value: 'FLAG' },
  { label: 'Suspend', value: 'SUSPEND' },
  { label: 'Block', value: 'BLOCK' },
];

export function getRuleInstanceDisplayId(
  ruleId: string | undefined,
  ruleInstanceId: string | undefined,
): string {
  return ruleId ? `${ruleId} (${ruleInstanceId || 'N/A'})` : ruleInstanceId ?? 'N/A';
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

export const RULE_CASE_PRIORITY: { label: string; value: Priority }[] = PRIORITYS.map(
  (priority) => ({
    label: priority,
    value: priority,
  }),
);

export function ruleInstanceToFormValues(
  isRiskLevelsEnabled: boolean,
  ruleInstance?: RuleInstance,
) {
  const defaultTriggersOnHit: TriggersOnHit = {
    usersToCheck: 'ALL',
  };
  return ruleInstance
    ? {
        basicDetailsStep: {
          ruleName: ruleInstance.ruleNameAlias,
          ruleDescription: ruleInstance.ruleDescriptionAlias,
          ruleNature: ruleInstance.nature,
          casePriority: ruleInstance.casePriority,
          alertCreationInterval: ruleInstance.alertCreationInterval,
          ruleLabels: ruleInstance.labels,
          ruleInstanceId: ruleInstance.id,
          falsePositiveCheckEnabled: ruleInstance.falsePositiveCheckEnabled,
          queueId: ruleInstance.queueId,
          checklistTemplateId: ruleInstance.checklistTemplateId,
        } as RuleConfigurationFormValues['basicDetailsStep'],
        standardFiltersStep: ruleInstance.filters,
        ruleParametersStep: isRiskLevelsEnabled
          ? {
              riskLevelParameters:
                ruleInstance.riskLevelParameters ??
                (ruleInstance.parameters && {
                  VERY_HIGH: ruleInstance.parameters,
                  HIGH: ruleInstance.parameters,
                  MEDIUM: ruleInstance.parameters,
                  LOW: ruleInstance.parameters,
                  VERY_LOW: ruleInstance.parameters,
                }),
              riskLevelActions:
                ruleInstance.riskLevelActions ??
                (ruleInstance.action && {
                  VERY_HIGH: ruleInstance.action,
                  HIGH: ruleInstance.action,
                  MEDIUM: ruleInstance.action,
                  LOW: ruleInstance.action,
                  VERY_LOW: ruleInstance.action,
                }),
              riskLevelsTriggersOnHit:
                ruleInstance.riskLevelsTriggersOnHit ??
                (ruleInstance.triggersOnHit && {
                  VERY_HIGH: ruleInstance.triggersOnHit ?? defaultTriggersOnHit,
                  HIGH: ruleInstance.triggersOnHit ?? defaultTriggersOnHit,
                  MEDIUM: ruleInstance.triggersOnHit ?? defaultTriggersOnHit,
                  LOW: ruleInstance.triggersOnHit ?? defaultTriggersOnHit,
                  VERY_LOW: ruleInstance.triggersOnHit ?? defaultTriggersOnHit,
                }),
            }
          : {
              ruleParameters: ruleInstance.parameters,
              ruleAction: ruleInstance.action,
              triggersOnHit: ruleInstance.triggersOnHit ?? defaultTriggersOnHit,
            },
      }
    : undefined;
}

export function formValuesToRuleInstance(
  initialRuleInstance: RuleInstance,
  formValues: RuleConfigurationFormValues,
  isRiskLevelsEnabled: boolean,
): RuleInstance {
  const { basicDetailsStep, standardFiltersStep, ruleParametersStep } = formValues;
  const {
    ruleAction,
    ruleParameters,
    riskLevelParameters,
    riskLevelActions,
    riskLevelsTriggersOnHit,
    triggersOnHit,
  } = ruleParametersStep;
  const defaultTriggersOnHit: TriggersOnHit = {
    usersToCheck: 'ALL',
  };
  return {
    ...initialRuleInstance,
    ruleId: initialRuleInstance.ruleId,
    ruleNameAlias: basicDetailsStep.ruleName,
    ruleDescriptionAlias: basicDetailsStep.ruleDescription,
    filters: removeEmpty(standardFiltersStep),
    casePriority: basicDetailsStep.casePriority,
    alertCreationInterval: basicDetailsStep.alertCreationInterval,
    nature: basicDetailsStep.ruleNature,
    labels: basicDetailsStep.ruleLabels,
    falsePositiveCheckEnabled: basicDetailsStep.falsePositiveCheckEnabled,
    queueId: basicDetailsStep.queueId,
    checklistTemplateId: basicDetailsStep.checklistTemplateId,
    ...(isRiskLevelsEnabled
      ? {
          riskLevelParameters: riskLevelParameters
            ? {
                VERY_HIGH: removeEmpty(riskLevelParameters['VERY_HIGH']),
                HIGH: removeEmpty(riskLevelParameters['HIGH']),
                MEDIUM: removeEmpty(riskLevelParameters['MEDIUM']),
                LOW: removeEmpty(riskLevelParameters['LOW']),
                VERY_LOW: removeEmpty(riskLevelParameters['VERY_LOW']),
              }
            : {
                VERY_HIGH: removeEmpty(ruleParameters),
                HIGH: removeEmpty(ruleParameters),
                MEDIUM: removeEmpty(ruleParameters),
                LOW: removeEmpty(ruleParameters),
                VERY_LOW: removeEmpty(ruleParameters),
              },
          riskLevelActions: riskLevelActions
            ? {
                VERY_HIGH: riskLevelActions['VERY_HIGH'],
                HIGH: riskLevelActions['HIGH'],
                MEDIUM: riskLevelActions['MEDIUM'],
                LOW: riskLevelActions['LOW'],
                VERY_LOW: riskLevelActions['VERY_LOW'],
              }
            : ruleAction != null
            ? {
                VERY_HIGH: ruleAction,
                HIGH: ruleAction,
                MEDIUM: ruleAction,
                LOW: ruleAction,
                VERY_LOW: ruleAction,
              }
            : undefined,
          riskLevelsTriggersOnHit: riskLevelsTriggersOnHit
            ? {
                VERY_HIGH:
                  removeEmpty(riskLevelsTriggersOnHit['VERY_HIGH']) ?? defaultTriggersOnHit,
                HIGH: removeEmpty(riskLevelsTriggersOnHit['HIGH']) ?? defaultTriggersOnHit,
                MEDIUM: removeEmpty(riskLevelsTriggersOnHit['MEDIUM']) ?? defaultTriggersOnHit,
                LOW: removeEmpty(riskLevelsTriggersOnHit['LOW']) ?? defaultTriggersOnHit,
                VERY_LOW: removeEmpty(riskLevelsTriggersOnHit['VERY_LOW']) ?? defaultTriggersOnHit,
              }
            : undefined,
        }
      : {
          action: ruleAction ?? initialRuleInstance.action,
          parameters: removeEmpty(ruleParameters),
          triggersOnHit: removeEmpty(triggersOnHit) ?? defaultTriggersOnHit,
        }),
  };
}

export function useUpdateRuleInstance(
  onRuleInstanceUpdated?: (ruleInstance: RuleInstance) => void,
) {
  const api = useApi();
  return useMutation<RuleInstance, unknown, RuleInstance>(
    async (ruleInstance: RuleInstance) => {
      const gg = await api.putRuleInstancesRuleInstanceId({
        ruleInstanceId: ruleInstance.id!,
        RuleInstance: ruleInstance,
      });
      return gg;
    },
    {
      onSuccess: async (updatedRuleInstance) => {
        if (onRuleInstanceUpdated) {
          onRuleInstanceUpdated(updatedRuleInstance);
        }
        message.success(`Rule updated - ${updatedRuleInstance.ruleId} (${updatedRuleInstance.id})`);
      },
      onError: async (err) => {
        message.fatal(`Unable to update the rule - ${getErrorMessage(err)}`, err);
      },
    },
  );
}

export function useCreateRuleInstance(
  onRuleInstanceCreated?: (ruleInstance: RuleInstance) => void,
) {
  const api = useApi();
  return useMutation<RuleInstance, unknown, RuleInstance>(
    async (ruleInstance: RuleInstance) => {
      return await api.postRuleInstances({
        RuleInstance: ruleInstance,
      });
    },
    {
      onSuccess: async (newRuleInstance) => {
        if (onRuleInstanceCreated) {
          onRuleInstanceCreated(newRuleInstance);
        }
        message.success(`Rule created - ${newRuleInstance.ruleId} (${newRuleInstance.id})`);
      },
      onError: async (err) => {
        message.fatal(`Unable to create the rule - ${getErrorMessage(err)}`, err);
      },
    },
  );
}
