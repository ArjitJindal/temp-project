import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllValuesByKey } from '@flagright/lib/utils';
import {
  capitalizeNameFromEmail,
  firstLetterUpper,
  humanizeConstant,
} from '@flagright/lib/utils/humanize';
import { useAuth0User } from '@/utils/user-utils';
import { Option } from '@/components/library/SelectionGroup';
import { RuleConfigurationFormValues } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/RuleConfigurationForm';
import { RuleConfigurationFormV8Values } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8';
import { useApi } from '@/api';
import {
  Priority,
  Rule,
  RuleInstance,
  RuleLabels,
  RuleNature,
  RuleType,
  TenantSettings,
  TriggersOnHit,
} from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { removeEmpty } from '@/utils/json';
import { RuleInstanceMap, RulesMap } from '@/utils/rules';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { GET_RULE_INSTANCE, GET_RULE_INSTANCES, RULES } from '@/utils/queries/keys';
import { makeUrl } from '@/utils/routing';

export const RULE_ACTION_OPTIONS: { label: string; value: RuleAction }[] = [
  { label: 'Flag', value: 'FLAG' },
  { label: 'Suspend', value: 'SUSPEND' },
  { label: 'Block', value: 'BLOCK' },
];

export type FrozenStatuses = 'IN_PROGRESS' | 'ON_HOLD' | 'IN_REVIEW' | 'ESCALATED' | 'REOPENED';

export const FROZEN_STATUSES: {
  label: string;
  value: FrozenStatuses;
}[] = [
  { label: 'On hold', value: 'ON_HOLD' },
  { label: 'In review', value: 'IN_REVIEW' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Escalated', value: 'ESCALATED' },
  { label: 'Re-opened', value: 'REOPENED' },
];

export function getRuleInstanceDisplayId(
  ruleId: string | undefined,
  ruleInstanceId: string | undefined,
): string {
  return ruleId && !ruleInstanceId?.startsWith(ruleId)
    ? `${ruleId} (${ruleInstanceId || 'N/A'})`
    : ruleInstanceId ?? 'N/A';
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
  ruleInstanceId: string,
  rules: RulesMap,
  ruleInstances: RuleInstanceMap,
) {
  return ruleInstances[ruleInstanceId]?.ruleNameAlias || rules[ruleId]?.name || ruleId;
}

export const RULE_NATURE_LABELS: { [key in RuleNature]: string } = {
  AML: 'AML',
  FRAUD: 'Fraud',
  SCREENING: 'Screening',
  CTF: 'CTF',
};

export const RULE_NATURE_VALUES: RuleNature[] = Object.keys(RULE_NATURE_LABELS) as RuleNature[];

export const RULE_NATURE_OPTIONS: Option<RuleNature>[] = RULE_NATURE_VALUES.map((value) => ({
  label: RULE_NATURE_LABELS[value],
  value,
}));

export const getRuleTypeOptions = (tenantSettings: TenantSettings): Option<RuleType>[] => {
  return [
    {
      label: 'Transaction',
      value: 'TRANSACTION',
      description: `The rule checks for transactions and ${tenantSettings.userAlias} properties based on the defined rule logic. The rule is executed whenever a new transaction or transaction event occurs.`,
    },
    {
      label: firstLetterUpper(tenantSettings.userAlias),
      value: 'USER',
      description: `The rule checks ${tenantSettings.userAlias} properties based on the defined rule logic. The rule is executed whenever a new ${tenantSettings.userAlias} or new ${tenantSettings.userAlias} event occurs. For ongoing screening, the rule is also executed for existing ${tenantSettings.userAlias}.`,
    },
  ];
};

export type AlertCreatedForEnum = 'USER' | 'PAYMENT_DETAILS';

export const RULE_LABELS_OPTIONS = (
  isPnb: boolean,
): {
  [key in RuleNature]: { label: string; value: RuleLabels }[];
} => ({
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
    ...(isPnb ? [{ label: 'Manual review', value: 'SANCTIONS_MANUAL_REVIEW' as const }] : []),
  ],
  CTF: [
    { label: 'Unexpected behavior', value: 'UNEXPECTED_BEHAVIOR' },
    { label: 'Illicit gains check', value: 'ILLICIT_GAINS_CHECK' },
    { label: 'RFI trigger', value: 'RFI_TRIGGER' },
    { label: 'EDD trigger', value: 'EDD_TRIGGER' },
    { label: 'KYC trigger', value: 'KYC_TRIGGER' },
  ],
});

export const RULE_CASE_PRIORITY: { label: string; value: Priority }[] = PRIORITYS.map(
  (priority) => ({
    label: priority,
    value: priority,
  }),
);

export const getAlertCreatedFor = (
  tenantSettings: TenantSettings,
): { label: string; value: AlertCreatedForEnum }[] => {
  const alertCreatedFor = ['USER', 'PAYMENT_DETAILS'] as AlertCreatedForEnum[];
  return alertCreatedFor.map((alertCreatedFor) => ({
    label:
      alertCreatedFor === 'USER'
        ? firstLetterUpper(tenantSettings.userAlias)
        : humanizeConstant(alertCreatedFor),
    value: alertCreatedFor as AlertCreatedForEnum,
  }));
};

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
          screeningAlertCreationLogic: ruleInstance.screeningAlertCreationLogic,
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
          frozenStatuses: ruleInstance.alertConfig?.frozenStatuses,
          slaPolicies: ruleInstance.alertConfig?.slaPolicies,
          alertCreatedFor: ruleInstance.alertConfig?.alertCreatedFor ?? ['USER'],
          ruleExecutionMode: ruleInstance.ruleExecutionMode,
          alertCreationOnHit: ruleInstance.alertCreationOnHit,
          defaultAlertStatus: ruleInstance.alertConfig?.defaultAlertStatus,
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
      ruleType: ruleInstance.type,
      ruleName: ruleInstance.ruleNameAlias,
      ruleDescription: ruleInstance.ruleDescriptionAlias,
      ruleNature: ruleInstance.nature,
      ruleLabels: ruleInstance.labels,
      userRuleRunCondition: ruleInstance.userRuleRunCondition,
      ruleExecutionMode: ruleInstance.ruleExecutionMode,
      alertCreationOnHit: ruleInstance.alertCreationOnHit,
    },
    ruleIsHitWhenStep: {
      baseCurrency: ruleInstance.baseCurrency,
      ruleLogicEntityVariables: ruleInstance.logicEntityVariables,
      ruleLogicAggregationVariables: ruleInstance.logicAggregationVariables ?? [],
      ruleLogicMlVariables: ruleInstance.logicMachineLearningVariables ?? [],
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
    alertCreationDetailsStep: {
      alertCreatedFor: ruleInstance.alertConfig?.alertCreatedFor ?? ['USER'],
      alertCreationInterval: ruleInstance.alertConfig?.alertCreationInterval,
      alertPriority: ruleInstance.casePriority,
      falsePositiveCheckEnabled: ruleInstance.falsePositiveCheckEnabled ? 'true' : 'false',
      alertAssigneeRole: ruleInstance.alertConfig?.alertAssigneeRole,
      alertAssignees: ruleInstance.alertConfig?.alertAssignees,
      alertCreationDirection: ruleInstance.alertConfig?.alertCreationDirection,
      alertAssigneesType: ruleInstance.alertConfig?.alertAssigneeRole
        ? 'ROLE'
        : ruleInstance.alertConfig?.alertAssignees
        ? 'EMAIL'
        : undefined,
      checklistTemplateId: ruleInstance.checklistTemplateId,
      queueId: ruleInstance.queueId,
      frozenStatuses: ruleInstance.alertConfig?.frozenStatuses,
      slaPolicies: ruleInstance.alertConfig?.slaPolicies,
      defaultAlertStatus: ruleInstance.alertConfig?.defaultAlertStatus,
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
    mode: initialRuleInstance.mode,
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
    ruleExecutionMode: basicDetailsStep.ruleExecutionMode,
    alertCreationOnHit: basicDetailsStep.alertCreationOnHit,
    screeningAlertCreationLogic: basicDetailsStep.screeningAlertCreationLogic,
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
      frozenStatuses: basicDetailsStep.frozenStatuses,
      alertCreatedFor: basicDetailsStep.alertCreatedFor,
      slaPolicies: basicDetailsStep.slaPolicies,
      defaultAlertStatus: basicDetailsStep.defaultAlertStatus,
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
    ruleLogicEntityVariables,
    ruleLogicAggregationVariables,
    triggersOnHit,
    riskLevelsTriggersOnHit,
    baseCurrency,
    ruleLogicMlVariables,
  } = ruleIsHitWhenStep;
  const defaultTriggersOnHit: TriggersOnHit = {
    usersToCheck: 'ALL',
  };
  if (alertCreationDetailsStep.alertPriority == null || basicDetailsStep.ruleNature == null) {
    throw new Error(`Passed form values are not valid`);
  }

  return {
    ...initialRuleInstance,
    ruleId: initialRuleInstance.ruleId,
    type: basicDetailsStep.ruleType ?? 'TRANSACTION',
    ruleNameAlias: basicDetailsStep.ruleName,
    ruleDescriptionAlias: basicDetailsStep.ruleDescription,
    casePriority: alertCreationDetailsStep.alertPriority,
    nature: basicDetailsStep.ruleNature,
    labels: basicDetailsStep.ruleLabels ?? [],
    checksFor: initialRuleInstance.checksFor ?? [],
    falsePositiveCheckEnabled: alertCreationDetailsStep.falsePositiveCheckEnabled === 'true',
    queueId: alertCreationDetailsStep.queueId,
    checklistTemplateId: alertCreationDetailsStep.checklistTemplateId,
    userRuleRunCondition:
      basicDetailsStep.ruleType === 'USER' ? basicDetailsStep.userRuleRunCondition : undefined,
    ruleExecutionMode: basicDetailsStep.ruleExecutionMode ?? 'SYNC',
    alertCreationOnHit: basicDetailsStep.alertCreationOnHit,
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
      alertCreatedFor: alertCreationDetailsStep.alertCreatedFor,
      alertCreationDirection: alertCreationDetailsStep.alertCreationDirection,
      frozenStatuses: alertCreationDetailsStep.frozenStatuses,
      slaPolicies: alertCreationDetailsStep.slaPolicies,
      defaultAlertStatus: alertCreationDetailsStep.defaultAlertStatus,
    },
    baseCurrency,
    logicEntityVariables: ruleLogicEntityVariables,
    logicAggregationVariables: ruleLogicAggregationVariables,
    logicMachineLearningVariables: ruleLogicMlVariables,
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
  const queryClient = useQueryClient();
  const auth0User = useAuth0User();
  return useMutation<RuleInstance, unknown, RuleInstance>(
    async (ruleInstance: RuleInstance) => {
      if (ruleInstance.id == null) {
        throw new Error(`Rule instance ID is not defined, unable to update rule instance`);
      }
      return api.putRuleInstancesRuleInstanceId({
        ruleInstanceId: ruleInstance.id,
        RuleInstance: ruleInstance,
      });
    },
    {
      onSuccess: async (updatedRuleInstance) => {
        if (onRuleInstanceUpdated) {
          onRuleInstanceUpdated(updatedRuleInstance);
        }
        await queryClient.invalidateQueries(GET_RULE_INSTANCE(updatedRuleInstance.id as string));
        await queryClient.invalidateQueries(GET_RULE_INSTANCES());
        await queryClient.invalidateQueries(RULES());

        if (updatedRuleInstance.status === 'DEPLOYING') {
          message.success(
            `Rule ${updatedRuleInstance.id} has been successfully updated and will be live once deployed.`,
          );
        } else {
          message.success(`Rule updated successfully`, {
            details: `${capitalizeNameFromEmail(auth0User?.name || '')} updated the rule ${
              updatedRuleInstance.id
            }`,
            link: makeUrl('/rules/my-rules/:id/:mode', {
              id: updatedRuleInstance.id,
              mode: 'view',
            }),
            linkTitle: 'View rule',
            copyFeedback: 'Rule URL copied to clipboard',
          });
        }
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
  const auth0User = useAuth0User();
  const queryClient = useQueryClient();
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
        await queryClient.invalidateQueries(GET_RULE_INSTANCES());
        message.success(`A new rule has been created successfully`, {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} created the rule ${
            newRuleInstance.id
          }`,
          link: makeUrl('/rules/my-rules/:id/:mode', {
            id: newRuleInstance.id,
            mode: 'view',
          }),
          linkTitle: 'View rule',
          copyFeedback: 'Rule URL copied to clipboard',
        });
      },
      onError: async (err) => {
        message.fatal(`Unable to create the rule - Some parameters are missing`, err);
      },
    },
  );
}

export function useShouldUseV8Configuration(rule?: Rule, ruleInstance?: RuleInstance): boolean {
  const isV8Enabled = useFeatureEnabled('RULES_ENGINE_V8');

  return isV8Enabled && (!rule || isV8RuleInstance(isV8Enabled, ruleInstance));
}

export function isV8RuleInstance(v8Enabled: boolean, ruleInstance?: RuleInstance | null): boolean {
  return (
    v8Enabled &&
    ruleInstance &&
    (ruleInstance.logic || ruleInstance.riskLevelLogic) &&
    ruleInstance.ruleId?.startsWith('RC')
  );
}

export function useIsV8RuleInstance(ruleInstance?: RuleInstance | null): boolean {
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  return isV8RuleInstance(v8Enabled, ruleInstance);
}

export function isV8Rule(v8Enabled: boolean, rule?: Rule | null): boolean {
  return v8Enabled && rule && rule.defaultLogic;
}

export function useIsV8Rule(rule?: Rule | null): boolean {
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  return isV8Rule(v8Enabled, rule);
}

export function getAllEntityVariableKeys(logic: object): string[] {
  return getAllValuesByKey<string>('var', logic ?? {}).filter((v) => !v.startsWith('agg:'));
}

export function getAllAggVariableKeys(logic: object): string[] {
  return getAllValuesByKey<string>('var', logic ?? {}).filter((v) => v.startsWith('agg:'));
}

export const getRuleInstanceDescription = (
  ruleId: string,
  ruleInstances: RuleInstanceMap,
  rules: RulesMap,
) => {
  return ruleInstances[ruleId]?.ruleDescriptionAlias ?? rules[ruleId]?.description;
};

export function isShadowRule(ruleInstance: RuleInstance) {
  return ruleInstance.ruleRunMode === 'SHADOW';
}
