import { Typography } from 'antd';
import { useMemo, useState } from 'react';
import { startCase, toLower } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import COLORS from '@/components/ui/colors';
import { AuditLog, RuleAction, RuleInstance } from '@/apis';
import Modal from '@/components/library/Modal';
import { VariableTags } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';
import LogicBuilder from '@/components/ui/LogicBuilder';
import {
  useLogicBuilderConfig,
  useRuleLogicConfig,
} from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { QueryBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { isSuccess } from '@/utils/asyncResource';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useAuth0User } from '@/utils/user-utils';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import TableTemplate, { summariseChanges } from '@/pages/auditlog/components/TableTemplate';

interface Props {
  data: AuditLog;
}

const RuleAuditLogModal = (props: Props) => {
  const { data } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);

  // extract the rule logic and variables from the old and new images to represent
  // them separately from the rest of the data, after the tables
  const oldImage = data.oldImage as RuleInstance | undefined;
  const {
    logic: oldLogic,
    logicEntityVariables: oldEntityVariables = [],
    logicAggregationVariables: oldAggregationVariables = [],
    logicMachineLearningVariables: oldMlVariables = [],
    action: oldAction,
    ...oldImageRest
  } = oldImage ?? {};

  const newImage = data.newImage as RuleInstance;
  const {
    logic: newLogic,
    logicEntityVariables: newEntityVariables = [],
    logicAggregationVariables: newAggregationVariables = [],
    logicMachineLearningVariables: newMlVariables = [],
    action: newAction,
    ...newImageRest
  } = newImage ?? {};

  const { changedDetails, notChangedDetails } = summariseChanges({
    ...data,
    oldImage: oldImageRest,
    newImage: newImageRest,
  });

  const newLogicBuildConfigRes = useLogicBuilderConfig(
    data.newImage?.type,
    undefined,
    newEntityVariables,
    newAggregationVariables,
    {
      mode: 'VIEW',
    },
    newMlVariables,
  );

  const oldLogicBuildConfigRes = useLogicBuilderConfig(
    data.oldImage?.type,
    undefined,
    oldEntityVariables,
    oldAggregationVariables,
    {
      mode: 'VIEW',
    },
    oldMlVariables,
  );

  const settings = useSettings();

  const oldRuleLogicConfig = useRuleLogicConfig(oldImage?.type ?? 'TRANSACTION');
  const newRuleLogicConfig = useRuleLogicConfig(newImage.type);
  const user = useAuth0User();

  const oldVariableDefinitions = useMemo(() => {
    if (isSuccess(oldRuleLogicConfig.data)) {
      return (oldRuleLogicConfig.data.value.variables ?? []).filter(
        (v) =>
          (!v?.requiredFeatures?.length ||
            v.requiredFeatures.every((f) => settings.features?.includes(f))) &&
          (!v.tenantIds?.length || v.tenantIds?.includes(user?.tenantId)),
      );
    }
    return [];
  }, [oldRuleLogicConfig.data, settings.features, user.tenantId]);

  const newVariableDefinitions = useMemo(() => {
    if (isSuccess(newRuleLogicConfig.data)) {
      return (newRuleLogicConfig.data.value.variables ?? []).filter(
        (v) =>
          (!v?.requiredFeatures?.length ||
            v.requiredFeatures.every((f) => settings.features?.includes(f))) &&
          (!v.tenantIds?.length || v.tenantIds?.includes(user?.tenantId)),
      );
    }
    return [];
  }, [newRuleLogicConfig.data, settings.features, user.tenantId]);

  return (
    <>
      <Typography.Text
        style={{ color: COLORS.brandBlue.base, cursor: 'pointer' }}
        onClick={() => {
          setIsModalVisible(true);
        }}
      >
        View changes
      </Typography.Text>
      <Modal
        isOpen={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        width={'L'}
        hideFooter
        title={`Changes for ${humanizeAuto(data.type)}`}
      >
        <div style={{ padding: '1rem', width: '100%' }}>
          {changedDetails.length && (
            <>
              <Typography.Title level={4}>
                {startCase(toLower(data.type))} details changed
              </Typography.Title>
              <TableTemplate details={changedDetails} />
            </>
          )}
          <>
            {notChangedDetails.length > 0 && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>
                  {startCase(toLower(data.type))} details not changed
                </Typography.Title>
                <TableTemplate details={notChangedDetails} />
              </div>
            )}
          </>
          <>
            {(newEntityVariables.length > 0 || newAggregationVariables.length > 0) && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>New variables</Typography.Title>
                <VariableTags
                  readOnly={true}
                  entityVariables={newEntityVariables}
                  aggregationVariables={newAggregationVariables}
                  mlVariables={newMlVariables}
                  entityVariableDefinitions={newVariableDefinitions}
                />
              </div>
            )}
          </>
          <>
            {(oldEntityVariables.length > 0 || oldAggregationVariables.length > 0) && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>Old variables</Typography.Title>
                <VariableTags
                  readOnly={true}
                  entityVariables={oldEntityVariables}
                  aggregationVariables={oldAggregationVariables}
                  entityVariableDefinitions={oldVariableDefinitions}
                />
              </div>
            )}
          </>
          <>
            {newLogic && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>New logic</Typography.Title>
                <AsyncResourceRenderer resource={newLogicBuildConfigRes}>
                  {(logicBuildConfig: QueryBuilderConfig) => {
                    let propsTree = QbUtils.loadFromJsonLogic(newLogic, logicBuildConfig);
                    propsTree = propsTree
                      ? QbUtils.checkTree(propsTree, logicBuildConfig)
                      : undefined;

                    return <LogicBuilder value={propsTree} config={logicBuildConfig} />;
                  }}
                </AsyncResourceRenderer>
              </div>
            )}
          </>
          <>
            {oldLogic && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>Old logic</Typography.Title>
                <AsyncResourceRenderer resource={oldLogicBuildConfigRes}>
                  {(logicBuildConfig: QueryBuilderConfig) => {
                    let propsTree = QbUtils.loadFromJsonLogic(oldLogic, logicBuildConfig);
                    propsTree = propsTree
                      ? QbUtils.checkTree(propsTree, logicBuildConfig)
                      : undefined;

                    return <LogicBuilder value={propsTree} config={logicBuildConfig} />;
                  }}
                </AsyncResourceRenderer>
              </div>
            )}
          </>
          <>
            <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
              <Typography.Title level={4}>New action</Typography.Title>
              <RuleActionStatus ruleAction={newAction as RuleAction} />
            </div>
          </>
          {oldAction && (
            <>
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>Old action</Typography.Title>
                <RuleActionStatus ruleAction={oldAction as RuleAction} />
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

export default RuleAuditLogModal;
