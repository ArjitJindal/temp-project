import { Typography } from 'antd';
import { useMemo, useState } from 'react';
import { startCase, toLower } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import COLORS from '@/components/ui/colors';
import { AuditLog, RuleAction, RuleInstance } from '@/apis';
import Modal from '@/components/library/Modal';
import { VariableTags } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';
import { EntityVariableForm } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/EntityVariableForm';
import { AggregationVariableForm } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/AggregationVariableForm';
import { MlVariableForm } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/MlVariableForm';
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
import TableTemplate, {
  summariseChanges,
  summarizeAdvancedOptions,
} from '@/pages/auditlog/components/TableTemplate';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { RiskLevel } from '@/utils/risk-levels';

interface Props {
  data: AuditLog;
}

const RuleAuditLogModal = (props: Props) => {
  const { data } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [viewingVariable, setViewingVariable] = useState<{
    type: 'entity' | 'aggregation' | 'ml';
    variable: any;
    isOld?: boolean;
  } | null>(null);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<
    'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'
  >('VERY_LOW');

  // extract the rule logic and variables from the old and new images to represent
  // them separately from the rest of the data, after the tables
  const oldImage = data.oldImage as RuleInstance | undefined;
  const {
    logic: oldLogic,
    riskLevelLogic: oldRiskLevelLogic,
    logicEntityVariables: oldEntityVariables = [],
    logicAggregationVariables: oldAggregationVariables = [],
    logicMachineLearningVariables: oldMlVariables = [],
    action: oldAction,
    riskLevelActions: oldRiskLevelActions,
    triggersOnHit: oldTriggersOnHit,
    riskLevelsTriggersOnHit: oldRiskLevelsTriggersOnHit,
    ...oldImageRest
  } = oldImage ?? {};

  const newImage = data.newImage as RuleInstance;
  const {
    logic: newLogic,
    riskLevelLogic: newRiskLevelLogic,
    logicEntityVariables: newEntityVariables = [],
    logicAggregationVariables: newAggregationVariables = [],
    logicMachineLearningVariables: newMlVariables = [],
    action: newAction,
    riskLevelActions: newRiskLevelActions,
    triggersOnHit: newTriggersOnHit,
    riskLevelsTriggersOnHit: newRiskLevelsTriggersOnHit,
    ...newImageRest
  } = newImage ?? {};

  const { changedDetails, notChangedDetails } = summariseChanges({
    ...data,
    oldImage: oldImageRest,
    newImage: newImageRest,
  });

  const advancedOptions = summarizeAdvancedOptions({
    ...data,
    oldImage: oldTriggersOnHit,
    newImage: newTriggersOnHit,
  });

  const riskLevelAdvancedOptions = Object.keys(newRiskLevelsTriggersOnHit || {})
    .map((riskLevel) => {
      return {
        riskLevel,
        item: summarizeAdvancedOptions({
          ...data,
          oldImage: oldRiskLevelsTriggersOnHit?.[riskLevel] || {},
          newImage: newRiskLevelsTriggersOnHit?.[riskLevel] || {},
        }),
      };
    })
    .reduce((acc, curr) => {
      acc[curr.riskLevel] = curr.item;
      return acc;
    }, {});

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

  const handleViewVariable = (key: string, isOld = false) => {
    // Find the variable in either old or new variables
    const variables = isOld
      ? { entity: oldEntityVariables, agg: oldAggregationVariables, ml: oldMlVariables }
      : { entity: newEntityVariables, agg: newAggregationVariables, ml: newMlVariables };

    const entityVar = variables.entity?.find((v) => v.key === key);
    if (entityVar) {
      setViewingVariable({ type: 'entity', variable: entityVar, isOld });
      return;
    }

    const aggVar = variables.agg?.find((v) => v.key === key);
    if (aggVar) {
      setViewingVariable({ type: 'aggregation', variable: aggVar, isOld });
      return;
    }

    const mlVar = variables.ml?.find((v) => v.key === key);
    if (mlVar) {
      setViewingVariable({ type: 'ml', variable: mlVar, isOld });
    }
  };

  const showOldImage = oldImage && Object.keys(oldImage).length > 0;
  const showRiskLevels =
    settings.features?.includes('RISK_LEVELS') &&
    ((newRiskLevelLogic && newRiskLevelActions) || (oldRiskLevelLogic && oldRiskLevelActions));

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
              <TableTemplate details={changedDetails} showOldImage={showOldImage} />
            </>
          )}
          <>
            {notChangedDetails.length > 0 && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>
                  {startCase(toLower(data.type))} details not changed
                </Typography.Title>
                <TableTemplate details={notChangedDetails} showOldImage={showOldImage} />
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
                  onEdit={(key) => handleViewVariable(key, false)}
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
                  mlVariables={oldMlVariables}
                  entityVariableDefinitions={oldVariableDefinitions}
                  onEdit={(key) => handleViewVariable(key, true)}
                />
              </div>
            )}
          </>

          {showRiskLevels && (
            <>
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>Risk level</Typography.Title>
                <RiskLevelSwitch
                  value={selectedRiskLevel}
                  onChange={(newValue) => setSelectedRiskLevel(newValue as RiskLevel)}
                />
              </div>

              {/* OLD LOGIC WITH RISK LEVELS */}
              {oldRiskLevelLogic && (
                <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                  <Typography.Title level={4}>Old logic</Typography.Title>
                  <AsyncResourceRenderer resource={oldLogicBuildConfigRes}>
                    {(logicBuildConfig: QueryBuilderConfig) => {
                      const propsTree = QbUtils.loadFromJsonLogic(
                        oldRiskLevelLogic[selectedRiskLevel],
                        logicBuildConfig,
                      );
                      return <LogicBuilder value={propsTree} config={logicBuildConfig} />;
                    }}
                  </AsyncResourceRenderer>
                </div>
              )}

              {/* NEW LOGIC WITH RISK LEVELS */}
              {newRiskLevelLogic && (
                <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                  <Typography.Title level={4}>New logic</Typography.Title>
                  <AsyncResourceRenderer resource={newLogicBuildConfigRes}>
                    {(logicBuildConfig: QueryBuilderConfig) => {
                      const propsTree = QbUtils.loadFromJsonLogic(
                        newRiskLevelLogic[selectedRiskLevel],
                        logicBuildConfig,
                      );
                      return <LogicBuilder value={propsTree} config={logicBuildConfig} />;
                    }}
                  </AsyncResourceRenderer>
                </div>
              )}

              {/* OLD ACTION WITH RISK LEVELS */}
              {showRiskLevels && oldRiskLevelActions && (
                <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                  <Typography.Title level={4}>Old action</Typography.Title>
                  <RuleActionStatus
                    ruleAction={oldRiskLevelActions[selectedRiskLevel] as RuleAction}
                  />
                </div>
              )}

              {/* NEW ACTION WITH RISK LEVELS */}
              {showRiskLevels && newRiskLevelActions && (
                <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                  <Typography.Title level={4}>New action</Typography.Title>
                  <RuleActionStatus
                    ruleAction={newRiskLevelActions[selectedRiskLevel] as RuleAction}
                  />
                </div>
              )}

              {/* NEW AND OLD ADVANCED OPTIONS (TRIGGERS ON HIT) WITH RISK LEVELS */}
              {showRiskLevels && newRiskLevelsTriggersOnHit && (
                <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                  <Typography.Title level={4}>Advanced options</Typography.Title>
                  <TableTemplate
                    details={riskLevelAdvancedOptions[selectedRiskLevel]}
                    showOldImage={showOldImage}
                  />
                </div>
              )}
            </>
          )}

          {!showRiskLevels && (
            <>
              {/* OLD LOGIC */}
              {oldLogic && !showRiskLevels && (
                <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                  <Typography.Title level={4}>Old logic</Typography.Title>
                  <AsyncResourceRenderer resource={oldLogicBuildConfigRes}>
                    {(logicBuildConfig: QueryBuilderConfig) => {
                      let propsTree;
                      propsTree = QbUtils.loadFromJsonLogic(oldLogic, logicBuildConfig);
                      propsTree = propsTree
                        ? QbUtils.checkTree(propsTree, logicBuildConfig)
                        : undefined;

                      return <LogicBuilder value={propsTree} config={logicBuildConfig} />;
                    }}
                  </AsyncResourceRenderer>
                </div>
              )}

              {/* NEW LOGIC */}
              {newLogic && (
                <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                  <Typography.Title level={4}>New logic</Typography.Title>
                  <AsyncResourceRenderer resource={newLogicBuildConfigRes}>
                    {(logicBuildConfig: QueryBuilderConfig) => {
                      let propsTree;
                      if (showRiskLevels && newRiskLevelLogic) {
                        propsTree = QbUtils.loadFromJsonLogic(
                          newRiskLevelLogic[selectedRiskLevel],
                          logicBuildConfig,
                        );
                      } else {
                        propsTree = QbUtils.loadFromJsonLogic(newLogic, logicBuildConfig);
                      }
                      propsTree = propsTree
                        ? QbUtils.checkTree(propsTree, logicBuildConfig)
                        : undefined;

                      return <LogicBuilder value={propsTree} config={logicBuildConfig} />;
                    }}
                  </AsyncResourceRenderer>
                </div>
              )}

              {/* OLD ACTION */}
              {oldAction && !showRiskLevels && (
                <>
                  <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                    <Typography.Title level={4}>Old action</Typography.Title>
                    <RuleActionStatus ruleAction={oldAction as RuleAction} />
                  </div>
                </>
              )}

              {/* NEW ACTION */}
              {!showRiskLevels && (
                <>
                  <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                    <Typography.Title level={4}>New action</Typography.Title>
                    <RuleActionStatus ruleAction={newAction as RuleAction} />
                  </div>
                </>
              )}

              {/* NEW AND OLD ADVANCED OPTIONS (TRIGGERS ON HIT) */}
              {advancedOptions.length > 0 && (
                <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                  <Typography.Title level={4}>Advanced options</Typography.Title>
                  <TableTemplate details={advancedOptions} showOldImage={showOldImage} />
                </div>
              )}
            </>
          )}

          {/* Add variable form modals */}
          {viewingVariable?.type === 'entity' && (
            <Modal
              isOpen={true}
              onCancel={() => setViewingVariable(null)}
              title={`${viewingVariable.isOld ? 'Old' : 'New'} Entity Variable Details`}
              hideFooter
            >
              <EntityVariableForm
                ruleType={viewingVariable.isOld && oldImage ? oldImage.type : newImage.type}
                variable={viewingVariable.variable}
                entityVariables={
                  viewingVariable.isOld ? oldVariableDefinitions : newVariableDefinitions
                }
                entityVariablesInUse={
                  viewingVariable.isOld ? oldEntityVariables : newEntityVariables
                }
                isNew={false}
                readOnly={true}
                onUpdate={() => {}}
                onCancel={() => setViewingVariable(null)}
              />
            </Modal>
          )}
          {viewingVariable?.type === 'aggregation' && (
            <Modal
              isOpen={true}
              onCancel={() => setViewingVariable(null)}
              title={`${viewingVariable.isOld ? 'Old' : 'New'} Aggregation Variable Details`}
              hideFooter
            >
              <AggregationVariableForm
                ruleType={viewingVariable.isOld && oldImage ? oldImage.type : newImage.type}
                variable={viewingVariable.variable}
                entityVariables={
                  viewingVariable.isOld ? oldVariableDefinitions : newVariableDefinitions
                }
                isNew={false}
                readOnly={true}
                onUpdate={() => {}}
                onCancel={() => setViewingVariable(null)}
              />
            </Modal>
          )}
          {viewingVariable?.type === 'ml' && (
            <Modal
              isOpen={true}
              onCancel={() => setViewingVariable(null)}
              title={`${viewingVariable.isOld ? 'Old' : 'New'} ML Variable Details`}
              hideFooter
            >
              <MlVariableForm
                variable={viewingVariable.variable}
                isNew={false}
                readOnly={true}
                onUpdate={() => {}}
                onCancel={() => setViewingVariable(null)}
              />
            </Modal>
          )}
        </div>
      </Modal>
    </>
  );
};

export default RuleAuditLogModal;
