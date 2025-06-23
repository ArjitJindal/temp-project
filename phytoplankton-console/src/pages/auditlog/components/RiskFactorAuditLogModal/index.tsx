import { Typography } from 'antd';
import { useMemo, useState } from 'react';
import { startCase, toLower } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import cn from 'clsx';
import s from './style.module.less';
import { AuditLog, RiskEntityType, RiskFactor } from '@/apis';
import Modal from '@/components/library/Modal';
import { VariableTags } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';
import { EntityVariableForm } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/EntityVariableForm';
import { AggregationVariableForm } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/AggregationVariableForm';
import { useLogicEntityVariablesList } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';
import { isSuccess } from '@/utils/asyncResource';
import { useRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useAuth0User } from '@/utils/user-utils';
import TableTemplate, { summariseChanges } from '@/pages/auditlog/components/TableTemplate';
import { RiskLevel } from '@/utils/risk-levels';
import Tag from '@/components/library/Tag';
import LogicDisplay from '@/components/ui/LogicDisplay';

interface Props {
  data: AuditLog;
}

const getRuleType = (entityType: RiskEntityType) => {
  return entityType === 'TRANSACTION' ? 'TRANSACTION' : 'USER';
};

const RiskFactorAuditLogModal = (props: Props) => {
  const { data } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [viewingVariable, setViewingVariable] = useState<{
    type: 'entity' | 'aggregation' | 'ml';
    variable: any;
    isOld?: boolean;
  } | null>(null);

  const oldImage = data.oldImage as RiskFactor | undefined;
  const {
    riskLevelLogic: oldRiskLevelLogic = [],
    logicEntityVariables: oldEntityVariables = [],
    logicAggregationVariables: oldAggregationVariables = [],
    ...oldImageRest
  } = oldImage ?? {};

  const newImage = data.newImage as RiskFactor;
  const {
    riskLevelLogic: newRiskLevelLogic = [],
    logicEntityVariables: newEntityVariables = [],
    logicAggregationVariables: newAggregationVariables = [],
    ...newImageRest
  } = newImage ?? {};

  const { changedDetails, notChangedDetails } = summariseChanges({
    ...data,
    oldImage: oldImageRest,
    newImage: newImageRest,
  });

  const settings = useSettings();

  const oldRuleLogicVars = useLogicEntityVariablesList(
    getRuleType(oldImage?.type ?? 'TRANSACTION'),
  );
  const newRuleLogicVars = useLogicEntityVariablesList(
    getRuleType(newImage?.type ?? 'TRANSACTION'),
  );
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
  const riskLevelLabel = useRiskLevelLabel;
  const handleViewVariable = (key: string, isOld = false) => {
    const variables = isOld
      ? { entity: oldEntityVariables, agg: oldAggregationVariables }
      : { entity: newEntityVariables, agg: newAggregationVariables };

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
  };

  const showOldImage = oldImage && Object.keys(oldImage).length > 0;
  return (
    <>
      <Typography.Text
        className={cn(s.text)}
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
        <div className={cn(s.container)}>
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
          <div className={cn(s.flexDisplay)}>
            <div className={cn(s.childContainer)}>
              <Typography.Title level={4}>Old variables</Typography.Title>
              {(oldEntityVariables.length > 0 || oldAggregationVariables.length > 0) && (
                <VariableTags
                  readOnly={true}
                  entityVariables={oldEntityVariables}
                  aggregationVariables={oldAggregationVariables}
                  entityVariableDefinitions={oldVariableDefinitions}
                  onEdit={(key) => handleViewVariable(key, true)}
                />
              )}
            </div>
            <div className={cn(s.childContainer)}>
              <Typography.Title level={4}>New variables</Typography.Title>
              {(newEntityVariables.length > 0 || newAggregationVariables.length > 0) && (
                <VariableTags
                  readOnly={true}
                  entityVariables={newEntityVariables}
                  aggregationVariables={newAggregationVariables}
                  entityVariableDefinitions={newVariableDefinitions}
                  onEdit={(key) => handleViewVariable(key, false)}
                />
              )}
            </div>
          </div>

          <div className={cn(s.flexDisplay)}>
            {/* OLD LOGIC */}
            <div className={cn(s.childContainer)}>
              <Typography.Title level={4}>Old logic</Typography.Title>
              {oldRiskLevelLogic.map((info, index) => (
                <div key={index} className={cn(s.riskLevelLogicItem)}>
                  <Tag color="action">
                    Configuration ({riskLevelLabel(info.riskLevel as RiskLevel)} {info.weight})
                  </Tag>
                  <LogicDisplay
                    logic={info.logic}
                    entityVariables={oldEntityVariables}
                    aggregationVariables={oldAggregationVariables}
                    ruleType={getRuleType(oldImage?.type ?? 'TRANSACTION')}
                  />
                </div>
              ))}
            </div>

            {/* NEW LOGIC */}
            <div className={cn(s.childContainer)}>
              <Typography.Title level={4}>New logic</Typography.Title>
              {newRiskLevelLogic.map((info, index) => (
                <div key={index} className={cn(s.riskLevelLogicItem)}>
                  <Tag color="action">
                    Configuration ({riskLevelLabel(info.riskLevel as RiskLevel)} {info.weight})
                  </Tag>
                  <LogicDisplay
                    logic={info.logic}
                    entityVariables={newEntityVariables}
                    aggregationVariables={newAggregationVariables}
                    ruleType={getRuleType(newImage?.type ?? 'TRANSACTION')}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Add variable form modals */}
          {viewingVariable?.type === 'entity' && (
            <Modal
              isOpen={true}
              onCancel={() => setViewingVariable(null)}
              title={`${viewingVariable.isOld ? 'Old' : 'New'} Entity Variable Details`}
              hideFooter
            >
              <EntityVariableForm
                ruleType={getRuleType(
                  viewingVariable.isOld && oldImage ? oldImage.type : newImage.type,
                )}
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
                ruleType={getRuleType(
                  viewingVariable.isOld && oldImage ? oldImage.type : newImage.type,
                )}
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
        </div>
      </Modal>
    </>
  );
};

export default RiskFactorAuditLogModal;
