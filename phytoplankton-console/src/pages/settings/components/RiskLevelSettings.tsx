import React, { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SettingsCard from '@/components/library/SettingsCard';
import Table from '@/components/library/Table';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { RiskLevel, RiskLevelAlias, RiskClassificationScore } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { STRING, BOOLEAN } from '@/components/library/Table/standardDataTypes';
import Button from '@/components/library/Button';
import { RISK_LEVELS, useRiskClassificationConfig } from '@/utils/risk-levels';
import { useApi } from '@/api';
import { RISK_CLASSIFICATION_VALUES } from '@/utils/queries/keys';

interface TableItem {
  level: RiskLevel;
  levelAlias: string;
  isActive: boolean;
}

const helper = new ColumnHelper<TableItem>();

export const RiskLevelSettings: React.FC = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const api = useApi();
  const queryClient = useQueryClient();
  const riskClassificationConfig = useRiskClassificationConfig();
  const [savingLevel, setSavingLevel] = useState<RiskLevel | null>(null);

  const levelToAlias = useMemo<Map<RiskLevel, string>>(
    () => new Map((settings.riskLevelAlias || []).map((entry) => [entry.level, entry.alias ?? ''])),
    [settings.riskLevelAlias],
  );

  const levelToActive = useMemo<Map<RiskLevel, boolean>>(
    () =>
      new Map(
        (settings.riskLevelAlias || []).map((entry) => [entry.level, entry.isActive ?? true]),
      ),
    [settings.riskLevelAlias],
  );

  const [committedLevelToAlias, setCommittedLevelToAlias] = useState<Map<RiskLevel, string>>(
    new Map([...levelToAlias]),
  );

  const [committedLevelToActive, setCommittedLevelToActive] = useState<Map<RiskLevel, boolean>>(
    new Map([...levelToActive]),
  );

  const savedLevelToAlias = useMemo(
    () => new Map([...levelToAlias, ...committedLevelToAlias]),
    [levelToAlias, committedLevelToAlias],
  );

  const savedLevelToActive = useMemo(
    () => new Map([...levelToActive, ...committedLevelToActive]),
    [levelToActive, committedLevelToActive],
  );

  const [newLevelToAlias, setNewLevelToAlias] = useState<Map<RiskLevel, string>>(
    new Map([...levelToAlias]),
  );

  const [newLevelToActive, setNewLevelToActive] = useState<Map<RiskLevel, boolean>>(
    new Map([...levelToActive]),
  );

  const handleUpdateAlias = useCallback(
    (level: RiskLevel, newAlias: string) => {
      setNewLevelToAlias(new Map(newLevelToAlias).set(level, newAlias.trim()));
    },
    [newLevelToAlias],
  );

  const recalculateRiskClassificationBounds = useCallback(
    (
      currentValues: RiskClassificationScore[],
      updatedLevelToActive: Map<RiskLevel, boolean>,
      previousLevelToActive?: Map<RiskLevel, boolean>,
    ): RiskClassificationScore[] => {
      const valuesMap = new Map<RiskLevel, RiskClassificationScore>();
      currentValues.forEach((value) => {
        valuesMap.set(value.riskLevel, value);
      });

      const results: RiskClassificationScore[] = [];

      RISK_LEVELS.forEach((level, index) => {
        const isActive = updatedLevelToActive.get(level) ?? true;
        const wasActive = previousLevelToActive?.get(level) ?? true;
        const isNewlyEnabled = !wasActive && isActive;
        const currentValue = valuesMap.get(level);
        const defaultLower = index * 20;
        const defaultUpper = index === RISK_LEVELS.length - 1 ? 100 : (index + 1) * 20;
        const currentLower = currentValue?.lowerBoundRiskScore ?? defaultLower;
        const currentUpper = currentValue?.upperBoundRiskScore ?? defaultUpper;

        let lowerBound: number;
        let upperBound: number;

        if (isActive) {
          if (isNewlyEnabled) {
            const firstActiveLevel = RISK_LEVELS.find((l) => updatedLevelToActive.get(l) ?? true);
            const firstActiveValue = firstActiveLevel ? valuesMap.get(firstActiveLevel) : undefined;
            lowerBound =
              firstActiveLevel === level ? 0 : firstActiveValue?.lowerBoundRiskScore ?? 0;
            upperBound = lowerBound;
          } else {
            const previousActiveLevels = RISK_LEVELS.slice(0, index).filter(
              (l) => updatedLevelToActive.get(l) ?? true,
            );

            if (previousActiveLevels.length === 0) {
              lowerBound = 0;
            } else {
              const previousLevel = RISK_LEVELS[index - 1];
              const isPreviousInactive = !(updatedLevelToActive.get(previousLevel) ?? true);

              if (isPreviousInactive) {
                const previousValue =
                  results.find((v) => v.riskLevel === previousLevel) ||
                  valuesMap.get(previousLevel);
                lowerBound = previousValue?.lowerBoundRiskScore ?? currentLower;
              } else {
                const previousValue = results.find((v) => v.riskLevel === previousLevel);
                lowerBound = previousValue?.upperBoundRiskScore ?? currentLower;
              }
            }

            const nextActiveLevels = RISK_LEVELS.slice(index + 1).filter(
              (l) => updatedLevelToActive.get(l) ?? true,
            );

            if (nextActiveLevels.length === 0) {
              upperBound = 100;
            } else if (currentUpper > lowerBound && currentUpper <= 100) {
              upperBound = currentUpper;
            } else {
              const remainingRange = 100 - lowerBound;
              const remainingLevels = nextActiveLevels.length + 1;
              upperBound = lowerBound + Math.floor(remainingRange / remainingLevels);
            }
          }

          lowerBound = Math.max(0, Math.min(lowerBound, 99));
          upperBound = Math.max(lowerBound, Math.min(upperBound, 100));
        } else {
          lowerBound = currentLower;
          upperBound = currentLower;
        }

        results.push({
          riskLevel: level,
          lowerBoundRiskScore: lowerBound,
          upperBoundRiskScore: upperBound,
        });
      });

      return results;
    },
    [],
  );

  const handleUpdateActive = useCallback(
    async (level: RiskLevel, newActive: boolean) => {
      const updatedNewLevelToActive = new Map(newLevelToActive).set(level, newActive);
      setNewLevelToActive(updatedNewLevelToActive);

      const updatedLevelToAlias = new Map(savedLevelToAlias);
      const updatedLevelToActive = new Map(savedLevelToActive).set(level, newActive);

      const riskLevelAlias: RiskLevelAlias[] = RISK_LEVELS.map((l) => ({
        level: l,
        alias: updatedLevelToAlias.get(l) ?? '',
        isActive: updatedLevelToActive.get(l) ?? true,
      }));

      try {
        setSavingLevel(level);
        await mutateTenantSettings.mutateAsync({ riskLevelAlias });

        const currentClassificationValues = riskClassificationConfig.data.classificationValues;
        if (currentClassificationValues?.length > 0) {
          const recalculatedValues = recalculateRiskClassificationBounds(
            currentClassificationValues,
            updatedLevelToActive,
            savedLevelToActive,
          );

          await api.postPulseRiskClassification({
            RiskClassificationRequest: {
              scores: recalculatedValues,
              comment: `Risk classification bounds updated due to ${level} status change to ${
                newActive ? 'active' : 'inactive'
              }`,
            },
          });

          await queryClient.invalidateQueries(RISK_CLASSIFICATION_VALUES());
        }

        setCommittedLevelToAlias(updatedLevelToAlias);
        setCommittedLevelToActive(updatedLevelToActive);
      } catch (error) {
        setNewLevelToActive(new Map(newLevelToActive));
        throw error;
      } finally {
        setSavingLevel(null);
      }
    },
    [
      newLevelToActive,
      savedLevelToAlias,
      savedLevelToActive,
      mutateTenantSettings,
      api,
      queryClient,
      riskClassificationConfig.data,
      recalculateRiskClassificationBounds,
    ],
  );

  const handleSaveRow = useCallback(
    async (level: RiskLevel, aliasOverride?: string, activeOverride?: boolean) => {
      setSavingLevel(level);
      try {
        const updatedLevelToAlias = new Map(savedLevelToAlias).set(
          level,
          aliasOverride ?? (newLevelToAlias.get(level) || ''),
        );

        const updatedLevelToActive = new Map(savedLevelToActive).set(
          level,
          activeOverride ?? newLevelToActive.get(level) ?? true,
        );

        const riskLevelAlias: RiskLevelAlias[] = RISK_LEVELS.map((l) => ({
          level: l,
          alias: updatedLevelToAlias.get(l) ?? '',
          isActive: updatedLevelToActive.get(l) ?? true,
        }));

        await mutateTenantSettings.mutateAsync({ riskLevelAlias });
        setCommittedLevelToAlias(updatedLevelToAlias);
        setCommittedLevelToActive(updatedLevelToActive);
      } finally {
        setSavingLevel(null);
      }
    },
    [
      savedLevelToAlias,
      savedLevelToActive,
      newLevelToAlias,
      newLevelToActive,
      mutateTenantSettings,
    ],
  );

  const tableData = useMemo<TableItem[]>(
    () =>
      RISK_LEVELS.map((level) => ({
        level,
        levelAlias: newLevelToAlias.get(level) ?? '',
        isActive: newLevelToActive.get(level) ?? true,
      })),
    [newLevelToAlias, newLevelToActive],
  );

  const columns = useMemo(
    () =>
      helper.list([
        helper.simple({
          key: 'level',
          title: 'Level',
          defaultWidth: 100,
        }),
        helper.simple({
          key: 'levelAlias',
          title: 'Alias',
          tooltip:
            'Allows you to add a name that will overwrite the default Risk level displayed in the Console. The Alias name is only used in the Console and will have no impact on the API.',
          type: STRING,
          defaultWidth: 200,
          defaultEditState: true,
        }),
        helper.simple({
          key: 'isActive',
          title: 'Status',
          tooltip: 'Toggle whether this risk level is active in the console.',
          type: BOOLEAN,
          defaultWidth: 140,
          defaultEditState: true,
        }),
        helper.display({
          title: 'Action',
          enableResizing: false,
          render: (item, ctx) => {
            const rowApi = ctx.rowApi;
            const draft = (rowApi?.getDraft?.() as TableItem) ?? item;
            const isBusy = rowApi?.isBusy;
            const hasUnsavedChanges =
              (draft.levelAlias ?? '') !== (item.levelAlias ?? '') ||
              draft.isActive !== item.isActive;
            return (
              <Button
                type="PRIMARY"
                onClick={() => rowApi?.save?.()}
                isDisabled={!hasUnsavedChanges}
                isLoading={isBusy || item.level === savingLevel}
                requiredResources={['write:::settings/risk-scoring/risk-levels-alias/*']}
              >
                Update
              </Button>
            );
          },
        }),
      ]),
    [savingLevel],
  );

  return (
    <SettingsCard
      title="Risk levels alias"
      description="Configure risk levels display name and active status in console."
      minRequiredResources={['read:::settings/risk-scoring/risk-levels-alias/*']}
    >
      <Table<TableItem>
        sizingMode="FULL_WIDTH"
        rowKey="level"
        columns={columns}
        data={{ items: tableData }}
        rowEditing={{
          mode: 'single',
          onSave: async (rowKey, drafted) => {
            handleUpdateAlias(rowKey as RiskLevel, drafted.levelAlias ?? '');
            handleUpdateActive(rowKey as RiskLevel, drafted.isActive ?? true);
            await handleSaveRow(
              rowKey as RiskLevel,
              drafted.levelAlias ?? '',
              drafted.isActive ?? true,
            );
          },
        }}
        pagination={false}
        toolsOptions={{
          reload: false,
          setting: false,
          download: false,
        }}
      />
    </SettingsCard>
  );
};
