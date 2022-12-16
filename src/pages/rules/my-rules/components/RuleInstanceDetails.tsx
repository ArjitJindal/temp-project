import ProDescriptions from '@ant-design/pro-descriptions';
import { Checkbox, Input, message, Radio, Row, Space } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useCallback, useState } from 'react';
import {
  RULE_CASE_CREATION_TYPE_OPTIONS,
  RULE_CASE_PRIORITY,
  RULE_NATURE_OPTIONS,
} from '../../utils';
import { ruleIdsWithAllowedFalsePositiveCheck } from '../../create-rule/components/RuleConfigurationsEditor/consts';
import { Rule, RuleInstance } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import { RuleParametersEditor } from '@/components/rules/RuleParametersEditor';
import { RiskLevel } from '@/apis/models/RiskLevel';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RuleFiltersEditor } from '@/components/rules/RuleFiltersEditor';

interface Props {
  rule: Rule;
  ruleParametersSchema: object;
  ruleInstance: RuleInstance;
  onRuleInstanceUpdate: (newRuleInstance: RuleInstance) => Promise<void>;
  onRuleInstanceDeleted: () => void;
}
export const RuleInstanceDetails: React.FC<Props> = ({
  rule,
  ruleInstance,
  ruleParametersSchema,
  onRuleInstanceUpdate,
  onRuleInstanceDeleted,
}) => {
  const api = useApi();
  const isPulseEnabled = useFeature('PULSE');
  const isFalsePositiveCheckEnabled = useFeature('FALSE_POSITIVE_CHECK');

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ruleNameAlias, setRuleNameAlias] = useState(ruleInstance.ruleNameAlias);
  const [parameters, setParameters] = useState(ruleInstance.parameters);
  const [filters, setFilters] = useState(ruleInstance.filters);
  const [riskLevelParameters, setRiskLevelParameters] = useState(
    ruleInstance.riskLevelParameters ||
      (isPulseEnabled
        ? {
            VERY_HIGH: ruleInstance.parameters,
            HIGH: ruleInstance.parameters,
            MEDIUM: ruleInstance.parameters,
            LOW: ruleInstance.parameters,
            VERY_LOW: ruleInstance.parameters,
          }
        : undefined),
  );
  const [ruleAction, setRuleAction] = useState<RuleAction>(ruleInstance.action);
  const [riskLevelActions, setRiskLevelActions] = useState(
    ruleInstance.riskLevelActions ||
      (isPulseEnabled
        ? {
            VERY_HIGH: rule.defaultAction,
            HIGH: rule.defaultAction,
            MEDIUM: rule.defaultAction,
            LOW: rule.defaultAction,
            VERY_LOW: rule.defaultAction,
          }
        : undefined),
  );
  const [caseCreationType, setCaseCreationType] = useState(ruleInstance.caseCreationType);
  const [casePriority, setCasePriority] = useState(ruleInstance.casePriority);
  const [nature, setNature] = useState(ruleInstance.nature);
  const [falsePositiveCheckEnabled, setFalsePositiveCheckEnabled] = useState<boolean>(
    ruleInstance.falsePositiveCheckEnabled ?? false,
  );
  const handleCancelEditing = useCallback(() => {
    setEditing(false);
    setParameters(ruleInstance.parameters);
    setRuleAction(ruleInstance.action);
    setCaseCreationType(ruleInstance.caseCreationType);
    setCasePriority(ruleInstance.casePriority);
    setFalsePositiveCheckEnabled(ruleInstance.falsePositiveCheckEnabled ?? false);
    setNature(ruleInstance.nature);
    console.log('done cancel');
  }, [
    ruleInstance.action,
    ruleInstance.parameters,
    ruleInstance.caseCreationType,
    ruleInstance.casePriority,
    ruleInstance.falsePositiveCheckEnabled,
    ruleInstance.nature,
  ]);
  const handleParametersChange = useCallback((newParameters: object) => {
    setParameters(newParameters);
  }, []);
  const handleFiltersChange = useCallback((newFilters: object) => {
    setFilters(newFilters);
  }, []);
  const handleRiskLevelParametersChange = useCallback(
    (riskLevel: RiskLevel, newParameters: object) => {
      if (riskLevelParameters) {
        setRiskLevelParameters({
          ...riskLevelParameters,
          [riskLevel]: newParameters,
        });
      }
    },
    [riskLevelParameters],
  );
  const handleUpdateRuleInstance = useCallback(async () => {
    const hideMessage = message.loading(`Updating rule ${rule.id}...`, 0);
    try {
      setSaving(true);
      await onRuleInstanceUpdate({
        ...ruleInstance,
        // We don't save rule name alias if it's the same as the rule name
        ruleNameAlias: ruleNameAlias === rule.name ? undefined : ruleNameAlias,
        filters,
        parameters,
        riskLevelParameters,
        action: ruleAction,
        riskLevelActions,
        caseCreationType,
        casePriority,
        falsePositiveCheckEnabled,
      });
      message.success(`Successfully updated rule ${rule.id}`);
      setEditing(false);
    } catch (e) {
      message.error(`Failed to update rule ${rule.id}`);
    } finally {
      hideMessage();
      setSaving(false);
    }
  }, [
    rule.id,
    rule.name,
    onRuleInstanceUpdate,
    ruleInstance,
    ruleNameAlias,
    filters,
    parameters,
    riskLevelParameters,
    ruleAction,
    riskLevelActions,
    caseCreationType,
    casePriority,
    falsePositiveCheckEnabled,
  ]);
  const handleDeleteRuleInstance = useCallback(async () => {
    setDeleting(true);
    await api.deleteRuleInstancesRuleInstanceId({ ruleInstanceId: ruleInstance.id as string });
    message.success(`Successfully deleted rule ${rule.id}`);
    onRuleInstanceDeleted();
    setDeleting(false);
  }, [api, onRuleInstanceDeleted, rule.id, ruleInstance.id]);

  return (
    <>
      <Row justify="end">
        {editing ? (
          <Space>
            <Button analyticsName="Cancel" onClick={handleCancelEditing} size="small">
              Cancel
            </Button>
            <Button
              analyticsName="Save"
              type="primary"
              size="small"
              onClick={handleUpdateRuleInstance}
              loading={saving}
            >
              Save
            </Button>
          </Space>
        ) : (
          <Space>
            <Button
              analyticsName="Edit"
              icon={<EditOutlined />}
              onClick={() => setEditing(true)}
              size="small"
            >
              Edit
            </Button>
            <Button
              analyticsName="Delete"
              icon={<DeleteOutlined />}
              onClick={handleDeleteRuleInstance}
              size="small"
              loading={deleting}
              danger
            >
              Delete
            </Button>
          </Space>
        )}
      </Row>
      <ProDescriptions column={1} colon={false} layout="vertical">
        <ProDescriptions.Item label={<b>Rule ID:</b>} valueType="text">
          {`${ruleInstance.ruleId} (${ruleInstance.id})`}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Rule Name:</b>} valueType="text">
          {editing && !saving ? (
            <Input
              value={ruleNameAlias || rule.name}
              onChange={(event) => setRuleNameAlias(event.target.value)}
            />
          ) : (
            ruleInstance.ruleNameAlias || rule.name
          )}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Rule Description:</b>} valueType="text">
          {rule.description}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Created At:</b>} valueType="dateTime">
          {ruleInstance.createdAt}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Updated At:</b>} valueType="dateTime">
          {ruleInstance.createdAt}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Case Creation Type</b>}>
          <Radio.Group
            name="caseCreationType"
            options={RULE_CASE_CREATION_TYPE_OPTIONS}
            onChange={(event) => setCaseCreationType(event.target.value)}
            optionType="button"
            disabled={!editing || saving}
            value={caseCreationType}
          ></Radio.Group>
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Nature</b>}>
          <Radio.Group
            name="ruleNature"
            options={RULE_NATURE_OPTIONS}
            onChange={(event) => setNature(event.target.value)}
            optionType="button"
            disabled={!editing || saving}
            value={nature}
          ></Radio.Group>
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Case Priority</b>}>
          <Radio.Group
            name="casePriority"
            options={RULE_CASE_PRIORITY}
            onChange={(event) => setCasePriority(event.target.value)}
            optionType="button"
            disabled={!editing || saving}
            value={casePriority}
          ></Radio.Group>
        </ProDescriptions.Item>
        {isFalsePositiveCheckEnabled && ruleIdsWithAllowedFalsePositiveCheck.includes(rule.id) && (
          <ProDescriptions.Item label={<b>False Positive Check</b>}>
            <Checkbox
              name="falsePositiveCheckEnabled"
              disabled={!editing || saving}
              onChange={() => {
                console.log(`FP: ${falsePositiveCheckEnabled}`);
                setFalsePositiveCheckEnabled(!falsePositiveCheckEnabled);
              }}
              checked={falsePositiveCheckEnabled}
            ></Checkbox>
          </ProDescriptions.Item>
        )}
        <ProDescriptions.Item label={<b>Filters:</b>} valueType="text">
          <RuleFiltersEditor
            filters={filters}
            readonly={!editing || saving}
            onChange={handleFiltersChange}
          />
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Parameters:</b>} valueType="text">
          <RuleParametersEditor
            parametersSchema={ruleParametersSchema}
            parameters={parameters}
            action={ruleAction}
            riskLevelActions={riskLevelActions}
            riskLevelParameters={riskLevelParameters}
            readonly={!editing || saving}
            onActionChange={setRuleAction}
            onRiskLevelActionChange={(riskLevel, newAction) =>
              riskLevelActions &&
              setRiskLevelActions({ ...riskLevelActions, [riskLevel]: newAction })
            }
            onParametersChange={handleParametersChange}
            onRiskLevelParametersChange={handleRiskLevelParametersChange}
          />
        </ProDescriptions.Item>
      </ProDescriptions>
    </>
  );
};
