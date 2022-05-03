import ProDescriptions from '@ant-design/pro-descriptions';
import { Button, message, Radio, Row, Space, Tag } from 'antd';
import { withTheme, AjvError, IChangeEvent } from '@rjsf/core';
import { Theme } from '@rjsf/antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Fragment, useCallback, useState } from 'react';
import { getRuleActionColor, RULE_ACTION_OPTIONS } from '../../utils';
import { Rule, RuleInstance } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { useApi } from '@/api';

const JSONSchemaForm = withTheme(Theme);

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [parameters, setParameters] = useState(ruleInstance.parameters);
  const [ruleAction, setRuleAction] = useState<RuleAction>(ruleInstance.action);
  const [validationErrors, setValidationErrors] = useState<AjvError[]>([]);
  const handleCancelEditing = useCallback(() => {
    setEditing(false);
    setParameters(ruleInstance.parameters);
    setRuleAction(ruleInstance.action);
  }, [ruleInstance.action, ruleInstance.parameters]);
  const handleParametersChange = useCallback((event: IChangeEvent) => {
    setParameters(event.formData);
    setValidationErrors(event.errors);
  }, []);
  const handleUpdateRuleInstance = useCallback(async () => {
    const hideMessage = message.loading(`Updating rule ${rule.id}...`, 0);
    try {
      setSaving(true);
      await onRuleInstanceUpdate({
        ...ruleInstance,
        parameters,
        action: ruleAction,
      });
      message.success(`Successfully updated rule ${rule.id}`);
      setEditing(false);
    } catch (e) {
      message.error(`Failed to update rule ${rule.id}`);
    } finally {
      hideMessage();
      setSaving(false);
    }
  }, [onRuleInstanceUpdate, parameters, rule.id, ruleAction, ruleInstance]);
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
            <Button onClick={handleCancelEditing} size="small">
              Cancel
            </Button>
            <Button
              type="primary"
              danger
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
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)} size="small">
              Edit
            </Button>
            <Button
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
        <ProDescriptions.Item label={<b>Action:</b>} valueType="text">
          {editing ? (
            <Radio.Group
              options={RULE_ACTION_OPTIONS}
              onChange={(e) => {
                setRuleAction(e.target.value);
              }}
              value={ruleAction}
              optionType="button"
              buttonStyle="solid"
              style={{ margin: '0px auto', width: '100%', textAlign: 'center' }}
              size="large"
            />
          ) : (
            <Tag color={getRuleActionColor(ruleInstance.action)}>{ruleInstance.action}</Tag>
          )}
        </ProDescriptions.Item>
        <ProDescriptions.Item label={<b>Parameters:</b>} valueType="text">
          <JSONSchemaForm
            schema={ruleParametersSchema}
            formData={ruleInstance.parameters}
            onChange={handleParametersChange}
            readonly={!editing}
            liveValidate
          >
            <Fragment />
          </JSONSchemaForm>
        </ProDescriptions.Item>
      </ProDescriptions>
    </>
  );
};
