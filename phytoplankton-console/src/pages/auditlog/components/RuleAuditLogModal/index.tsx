import { Typography } from 'antd';
import { useMemo, useState } from 'react';
import { startCase, toLower } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import COLORS from '@/components/ui/colors';
import { AuditLog, RuleAction, RuleInstance } from '@/apis';
import Modal from '@/components/library/Modal';
import { VariableTags } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';
import { EntityVariableForm } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/EntityVariableForm';
import { AggregationVariableForm } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/AggregationVariableForm';
import { MlVariableForm } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/MlVariableForm';
import { useLogicEntityVariablesList } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';
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
import LogicDisplay from '@/components/ui/LogicDisplay';

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

  const settings = useSettings();

  const oldRuleLogicVars = useLogicEntityVariablesList(oldImage?.type ?? 'TRANSACTION');
  const newRuleLogicVars = useLogicEntityVariablesList(newImage.type);
  const user = useAuth0User();

  const oldVariableDefinitions = useMemo(() => {
    if (isSuccess(oldRuleLogicVars)) {
      return (oldRuleLogicVars.value ?? []).filter(
        (v) =>
          (!v?.requiredFeatures?.length ||
            v.requiredFeatures.every((f) => settings.features?.includes(f))) &&
          (!v.tenantIds?.length || v.tenantIds?.includes(user?.tenantId)),
      );
    }
    return [];
  }, [oldRuleLogicVars, settings.features, user.tenantId]);

  const newVariableDefinitions = useMemo(() => {
    if (isSuccess(newRuleLogicVars)) {
      return (newRuleLogicVars.value ?? []).filter(
        (v) =>
          (!v?.requiredFeatures?.length ||
            v.requiredFeatures.every((f) => settings.features?.includes(f))) &&
          (!v.tenantIds?.length || v.tenantIds?.includes(user?.tenantId)),
      );
    }
    return [];
  }, [newRuleLogicVars, settings.features, user.tenantId]);

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

  const oldLogicToDisplay = useMemo(() => {
    if (showRiskLevels && oldRiskLevelLogic) {
      return oldRiskLevelLogic[selectedRiskLevel];
    }
    return oldLogic;
  }, [showRiskLevels, oldRiskLevelLogic, selectedRiskLevel, oldLogic]);

  const newLogicToDisplay = useMemo(() => {
    if (showRiskLevels && newRiskLevelLogic) {
      return newRiskLevelLogic[selectedRiskLevel];
    }
    return newLogic;
  }, [showRiskLevels, newRiskLevelLogic, selectedRiskLevel, newLogic]);

  const oldActionToDisplay = useMemo(() => {
    if (showRiskLevels && oldRiskLevelActions) {
      return oldRiskLevelActions[selectedRiskLevel];
    }
    return oldAction;
  }, [showRiskLevels, oldRiskLevelActions, selectedRiskLevel, oldAction]);

  const newActionToDisplay = useMemo(() => {
    if (showRiskLevels && newRiskLevelActions) {
      return newRiskLevelActions[selectedRiskLevel];
    }
    return newAction;
  }, [showRiskLevels, newRiskLevelActions, selectedRiskLevel, newAction]);

  const advancedOptionsToDisplay = useMemo(() => {
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
    if (showRiskLevels) {
      return riskLevelAdvancedOptions[selectedRiskLevel] ?? [];
    }
    return advancedOptions;
  }, [
    data,
    oldTriggersOnHit,
    newTriggersOnHit,
    newRiskLevelsTriggersOnHit,
    oldRiskLevelsTriggersOnHit,
    selectedRiskLevel,
    showRiskLevels,
  ]);

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

          <>
            <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
              <Typography.Title level={4}>Risk level</Typography.Title>
              <RiskLevelSwitch
                value={selectedRiskLevel}
                onChange={(newValue) => setSelectedRiskLevel(newValue as RiskLevel)}
              />
            </div>

            {/* OLD LOGIC WITH RISK LEVELS */}
            {oldLogicToDisplay && oldImage && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>Old logic</Typography.Title>
                <LogicDisplayWrapper image={oldImage} logic={oldLogicToDisplay} />
              </div>
            )}

            {/* NEW LOGIC WITH RISK LEVELS */}
            {newLogicToDisplay && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>New logic</Typography.Title>
                <LogicDisplayWrapper image={newImage} logic={newLogicToDisplay} />
              </div>
            )}

            {/* OLD ACTION WITH RISK LEVELS */}
            {oldActionToDisplay && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>Old action</Typography.Title>
                <RuleActionStatus ruleAction={oldActionToDisplay as RuleAction} />
              </div>
            )}

            {/* NEW ACTION WITH RISK LEVELS */}
            {newActionToDisplay && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>New action</Typography.Title>
                <RuleActionStatus ruleAction={newActionToDisplay as RuleAction} />
              </div>
            )}

            {/* NEW AND OLD ADVANCED OPTIONS (TRIGGERS ON HIT) WITH RISK LEVELS */}
            {advancedOptionsToDisplay.length > 0 && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>Advanced options</Typography.Title>
                <TableTemplate details={advancedOptionsToDisplay} showOldImage={showOldImage} />
              </div>
            )}
          </>

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

/*
  Helpers
*/
function LogicDisplayWrapper(props: { logic: object | undefined; image: RuleInstance }) {
  const { logic, image } = props;
  const {
    type,
    logicEntityVariables = [],
    logicAggregationVariables = [],
    logicMachineLearningVariables = [],
  } = image ?? {};

  return (
    <LogicDisplay
      logic={logic}
      entityVariables={logicEntityVariables}
      aggregationVariables={logicAggregationVariables}
      machineLearningVariables={logicMachineLearningVariables}
      ruleType={type}
    />
  );
}
