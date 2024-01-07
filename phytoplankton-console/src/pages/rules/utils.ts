import { useMutation } from '@tanstack/react-query';
import { RuleConfigurationFormValues } from './RuleConfigurationDrawer/RuleConfigurationForm';
import { RuleConfigurationFormV8Values } from './RuleConfigurationDrawerV8/RuleConfigurationFormV8';
import { useApi } from '@/api';
import {
  Rule,
  Priority,
  RuleInstance,
  RuleLabels,
  RuleNature,
  TriggersOnHit,
  RuleInstanceAlertCreatedForEnum,
} from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { removeEmpty } from '@/utils/json';
import { RuleInstanceMap, RulesMap } from '@/utils/rules';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import { humanizeConstant } from '@/utils/humanize';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';

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

export const ALERT_CREATED_FOR: { label: string; value: RuleInstanceAlertCreatedForEnum }[] = (
  ['USER', 'PAYMENT_DETAILS'] as RuleInstanceAlertCreatedForEnum[]
).map((alertCreatedFor) => ({
  label: humanizeConstant(alertCreatedFor),
  value: alertCreatedFor as RuleInstanceAlertCreatedForEnum,
}));

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
          ruleLabels: ruleInstance.labels,
          ruleInstanceId: ruleInstance.id,
          falsePositiveCheckEnabled: ruleInstance.falsePositiveCheckEnabled,
          queueId: ruleInstance.queueId,
          checksFor: ruleInstance.checksFor,
          checklistTemplateId: ruleInstance.checklistTemplateId,
          alertCreationInterval: ruleInstance.alertConfig?.alertCreationInterval,
          alertAssigneesType: ruleInstance.alertConfig?.alertAssigneeRole
            ? 'ROLE'
            : ruleInstance.alertConfig?.alertAssignees
            ? 'EMAIL'
            : undefined,
          alertAssignees: ruleInstance.alertConfig?.alertAssignees,
          alertAssigneeRole: ruleInstance.alertConfig?.alertAssigneeRole,
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

export function ruleInstanceToFormValuesV8(
  isRiskLevelsEnabled: boolean,
  ruleInstance?: RuleInstance,
): RuleConfigurationFormV8Values | undefined {
  if (!ruleInstance) {
    return undefined;
  }

  const defaultTriggersOnHit: TriggersOnHit = {
    usersToCheck: 'ALL',
  };
  return {
    basicDetailsStep: {
      ruleName: ruleInstance.ruleNameAlias,
      ruleDescription: ruleInstance.ruleDescriptionAlias,
      ruleNature: ruleInstance.nature,
      ruleLabels: ruleInstance.labels,
    },
    ruleIsHitWhenStep: {
      ruleLogicAggregationVariables: ruleInstance.logicAggregationVariables ?? [],
      ...(isRiskLevelsEnabled
        ? {
            riskLevelRuleLogic:
              ruleInstance.riskLevelLogic ??
              (ruleInstance.logic && {
                VERY_HIGH: ruleInstance.logic,
                HIGH: ruleInstance.logic,
                MEDIUM: ruleInstance.logic,
                LOW: ruleInstance.logic,
                VERY_LOW: ruleInstance.logic,
              }),
            riskLevelRuleActions:
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
            ruleLogic: ruleInstance.logic,
            ruleParameters: ruleInstance.parameters,
            ruleAction: ruleInstance.action,
            triggersOnHit: ruleInstance.triggersOnHit ?? defaultTriggersOnHit,
          }),
    },
    ruleIsRunWhenStep: {},
    alertCreationDetailsStep: {
      alertCreatedFor: ruleInstance.alertCreatedFor,
      alertCreationInterval: ruleInstance.alertConfig?.alertCreationInterval,
      alertPriority: ruleInstance.casePriority,
      falsePositiveCheckEnabled: ruleInstance.falsePositiveCheckEnabled ? 'true' : 'false',
      alertAssigneeRole: ruleInstance.alertConfig?.alertAssigneeRole,
      alertAssignees: ruleInstance.alertConfig?.alertAssignees,
      alertAssigneesType: ruleInstance.alertConfig?.alertAssigneeRole
        ? 'ROLE'
        : ruleInstance.alertConfig?.alertAssignees
        ? 'EMAIL'
        : undefined,
      checklistTemplateId: ruleInstance.checklistTemplateId,
      queueId: ruleInstance.queueId,
    },
  };
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
    nature: basicDetailsStep.ruleNature,
    labels: basicDetailsStep.ruleLabels,
    checksFor: basicDetailsStep.checksFor,
    falsePositiveCheckEnabled: basicDetailsStep.falsePositiveCheckEnabled,
    queueId: basicDetailsStep.queueId,
    checklistTemplateId: basicDetailsStep.checklistTemplateId,
    alertConfig: {
      alertAssignees:
        basicDetailsStep.alertAssigneesType == 'EMAIL'
          ? basicDetailsStep.alertAssignees
          : undefined,
      alertAssigneeRole:
        basicDetailsStep.alertAssigneesType == 'ROLE'
          ? basicDetailsStep.alertAssigneeRole
          : undefined,
      alertCreationInterval: basicDetailsStep.alertCreationInterval,
    },
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

export function formValuesToRuleInstanceV8(
  initialRuleInstance: RuleInstance,
  formValues: RuleConfigurationFormV8Values,
  isRiskLevelsEnabled: boolean,
): RuleInstance {
  const { basicDetailsStep, ruleIsHitWhenStep, alertCreationDetailsStep } = formValues;
  const {
    ruleAction,
    riskLevelRuleActions,
    ruleLogic,
    riskLevelRuleLogic,
    ruleLogicAggregationVariables,
    triggersOnHit,
    riskLevelsTriggersOnHit,
  } = ruleIsHitWhenStep;
  const defaultTriggersOnHit: TriggersOnHit = {
    usersToCheck: 'ALL',
  };
  return {
    ...initialRuleInstance,
    ruleId: initialRuleInstance.ruleId,
    ruleNameAlias: basicDetailsStep.ruleName,
    ruleDescriptionAlias: basicDetailsStep.ruleDescription,
    casePriority: alertCreationDetailsStep.alertPriority,
    nature: basicDetailsStep.ruleNature,
    labels: basicDetailsStep.ruleLabels,
    checksFor: initialRuleInstance.checksFor,
    alertCreatedFor: alertCreationDetailsStep.alertCreatedFor,
    falsePositiveCheckEnabled: alertCreationDetailsStep.falsePositiveCheckEnabled === 'true',
    queueId: alertCreationDetailsStep.queueId,
    checklistTemplateId: alertCreationDetailsStep.checklistTemplateId,
    alertConfig: {
      alertAssignees:
        alertCreationDetailsStep.alertAssigneesType == 'EMAIL'
          ? alertCreationDetailsStep.alertAssignees
          : undefined,
      alertAssigneeRole:
        alertCreationDetailsStep.alertAssigneesType == 'ROLE'
          ? alertCreationDetailsStep.alertAssigneeRole
          : undefined,
      alertCreationInterval: alertCreationDetailsStep.alertCreationInterval,
    },
    logicAggregationVariables: ruleLogicAggregationVariables,
    ...(isRiskLevelsEnabled
      ? {
          riskLevelLogic: riskLevelRuleLogic
            ? {
                VERY_HIGH: riskLevelRuleLogic['VERY_HIGH'],
                HIGH: riskLevelRuleLogic['HIGH'],
                MEDIUM: riskLevelRuleLogic['MEDIUM'],
                LOW: riskLevelRuleLogic['LOW'],
                VERY_LOW: riskLevelRuleLogic['VERY_LOW'],
              }
            : {
                VERY_HIGH: ruleLogic,
                HIGH: ruleLogic,
                MEDIUM: ruleLogic,
                LOW: ruleLogic,
                VERY_LOW: ruleLogic,
              },
          riskLevelActions: riskLevelRuleActions
            ? {
                VERY_HIGH: riskLevelRuleActions['VERY_HIGH'],
                HIGH: riskLevelRuleActions['HIGH'],
                MEDIUM: riskLevelRuleActions['MEDIUM'],
                LOW: riskLevelRuleActions['LOW'],
                VERY_LOW: riskLevelRuleActions['VERY_LOW'],
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
          logic: ruleLogic,
          action: ruleAction ?? initialRuleInstance.action,
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
      return api.putRuleInstancesRuleInstanceId({
        ruleInstanceId: ruleInstance.id!,
        RuleInstance: ruleInstance,
      });
    },
    {
      onSuccess: async (updatedRuleInstance) => {
        if (onRuleInstanceUpdated) {
          onRuleInstanceUpdated(updatedRuleInstance);
        }
        const ruleInfo = [
          updatedRuleInstance.id,
          updatedRuleInstance.ruleId && `(${updatedRuleInstance.ruleId})`,
        ]
          .filter(Boolean)
          .join(' ');
        message.success(`Rule updated - ${ruleInfo}`);
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
      return api.postRuleInstances({
        RuleInstance: ruleInstance,
      });
    },
    {
      onSuccess: async (newRuleInstance) => {
        if (onRuleInstanceCreated) {
          onRuleInstanceCreated(newRuleInstance);
        }
        const ruleInfo = [
          newRuleInstance.id,
          newRuleInstance.ruleId && `(${newRuleInstance.ruleId})`,
        ]
          .filter(Boolean)
          .join(' ');
        message.success(`Rule created - ${ruleInfo}`);
      },
      onError: async (err) => {
        message.fatal(`Unable to create the rule - Some parameters are missing`, err);
      },
    },
  );
}

export function useIsV8RuleInstance(ruleInstance?: RuleInstance | null): boolean {
  const user = useAuth0User();
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  return (
    isSuperAdmin(user) &&
    v8Enabled &&
    ruleInstance &&
    (ruleInstance.logic || ruleInstance.riskLevelLogic)
  );
}

export function useIsV8Rule(rule?: Rule | null): boolean {
  const user = useAuth0User();
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  return isSuperAdmin(user) && v8Enabled && rule && rule.defaultLogic;
}
