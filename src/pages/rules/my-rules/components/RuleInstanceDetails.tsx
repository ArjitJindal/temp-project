import ProDescriptions from '@ant-design/pro-descriptions';
import { message, Row, Space } from 'antd';
import { AjvError } from '@rjsf/core';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useCallback, useState } from 'react';
import { Rule, RuleInstance } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import { RuleParametersEditor } from '@/components/rules/RuleParametersEditor';
import { RiskLevel } from '@/apis/models/RiskLevel';
import { useFeature } from '@/components/AppWrapper/FeaturesProvider';

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [parameters, setParameters] = useState(ruleInstance.parameters);
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
  const [validationErrors, setValidationErrors] = useState<AjvError[]>([]);
  const handleCancelEditing = useCallback(() => {
    setEditing(false);
    setParameters(ruleInstance.parameters);
    setRuleAction(ruleInstance.action);
  }, [ruleInstance.action, ruleInstance.parameters]);
  const handleParametersChange = useCallback((newParameters: object, errors: AjvError[]) => {
    setParameters(newParameters);
    setValidationErrors(errors);
  }, []);
  const handleRiskLevelParametersChange = useCallback(
    (riskLevel: RiskLevel, newParameters: object, errors: AjvError[]) => {
      if (riskLevelParameters) {
        setRiskLevelParameters({
          ...riskLevelParameters,
          [riskLevel]: newParameters,
        });
      }
      setValidationErrors(errors);
    },
    [riskLevelParameters],
  );
  const handleUpdateRuleInstance = useCallback(async () => {
    const hideMessage = message.loading(`Updating rule ${rule.id}...`, 0);
    try {
      setSaving(true);
      await onRuleInstanceUpdate({
        ...ruleInstance,
        parameters,
        riskLevelParameters,
        action: ruleAction,
        riskLevelActions,
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
    onRuleInstanceUpdate,
    parameters,
    riskLevelActions,
    riskLevelParameters,
    rule.id,
    ruleAction,
    ruleInstance,
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
              disabled={validationErrors.length > 0}
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
          {rule.name}
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
        <ProDescriptions.Item label={<b>Parameters:</b>} valueType="text">
          <RuleParametersEditor
            parametersSchema={ruleParametersSchema}
            parameters={parameters}
            action={ruleAction}
            riskLevelActions={riskLevelActions}
            riskLevelParameters={riskLevelParameters}
            readonly={!editing}
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
