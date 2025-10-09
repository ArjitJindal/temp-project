import React, { useCallback, useMemo, useState } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import Table from '@/components/library/Table';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { RiskLevel, RiskLevelAlias } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { STRING, BOOLEAN } from '@/components/library/Table/standardDataTypes';
import Button from '@/components/library/Button';

interface TableItem {
  level: RiskLevel;
  levelAlias: string;
  isActive: boolean;
}

interface ExternalState {
  handleSaveAlias: (level: RiskLevel) => void;
  savingLevel: RiskLevel | null;
  newLevelToAlias: Map<RiskLevel, string>;
  newLevelToActive: Map<RiskLevel, boolean>;
  committedLevelToAlias: Map<RiskLevel, string>;
  committedLevelToActive: Map<RiskLevel, boolean>;
}
const helper = new ColumnHelper<TableItem>();

const columns = helper.list([
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
    defaultWidth: 120,
    defaultEditState: true,
  }),
  helper.display({
    title: 'Action',
    enableResizing: false,
    render: (item, context) => {
      const {
        handleSaveAlias,
        savingLevel,
        newLevelToAlias,
        newLevelToActive,
        committedLevelToAlias,
        committedLevelToActive,
      } = context.external as ExternalState;

      const aliasChanged =
        (committedLevelToAlias.get(item.level) ?? '') !== (newLevelToAlias.get(item.level) ?? '');

      const activeChanged =
        (committedLevelToActive.get(item.level) ?? true) !==
        (newLevelToActive.get(item.level) ?? true);

      return (
        <Button
          type="PRIMARY"
          onClick={() => handleSaveAlias(item.level)}
          isDisabled={!!savingLevel || (!aliasChanged && !activeChanged)}
          isLoading={item.level === savingLevel}
          requiredResources={['write:::settings/risk-scoring/risk-levels-alias/*']}
        >
          Update
        </Button>
      );
    },
  }),
]);

export const RiskLevelSettings: React.FC = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();

  const [savingLevel, setSavingLevel] = useState<RiskLevel | null>(null);

  const initialAliasMap = useMemo(
    () =>
      new Map<RiskLevel, string>(
        (settings.riskLevelAlias || []).map((entry) => [entry.level, entry.alias ?? '']),
      ),
    [settings.riskLevelAlias],
  );

  const initialActiveMap = useMemo(
    () =>
      new Map<RiskLevel, boolean>(
        (settings.riskLevelAlias || []).map((entry) => [entry.level, entry.isActive ?? true]),
      ),
    [settings.riskLevelAlias],
  );
  const [committedLevelToAlias, setCommittedLevelToAlias] = useState(initialAliasMap);
  const [committedLevelToActive, setCommittedLevelToActive] = useState(initialActiveMap);

  const [newLevelToAlias, setNewLevelToAlias] = useState(new Map(initialAliasMap));
  const [newLevelToActive, setNewLevelToActive] = useState(new Map(initialActiveMap));

  const handleUpdateAlias = useCallback((level: RiskLevel, newAlias: string) => {
    setNewLevelToAlias((prev) => new Map(prev).set(level, newAlias.trim()));
  }, []);

  const handleUpdateActive = useCallback((level: RiskLevel, newActive: boolean) => {
    setNewLevelToActive((prev) => new Map(prev).set(level, newActive));
  }, []);

  const handleSaveAlias = useCallback(
    async (level: RiskLevel) => {
      setSavingLevel(level);
      try {
        const updatedAliasMap = new Map(committedLevelToAlias).set(
          level,
          newLevelToAlias.get(level) ?? '',
        );
        const updatedActiveMap = new Map(committedLevelToActive).set(
          level,
          newLevelToActive.get(level) ?? true,
        );
        const riskLevelAlias: RiskLevelAlias[] = Array.from(updatedAliasMap.entries()).map(
          ([lvl, alias]) => ({
            level: lvl,
            alias,
            isActive: updatedActiveMap.get(lvl) ?? true,
          }),
        );

        await mutateTenantSettings.mutateAsync({ riskLevelAlias });

        setCommittedLevelToAlias(updatedAliasMap);
        setCommittedLevelToActive(updatedActiveMap);
      } finally {
        setSavingLevel(null);
      }
    },
    [
      mutateTenantSettings,
      newLevelToAlias,
      newLevelToActive,
      committedLevelToAlias,
      committedLevelToActive,
    ],
  );

  const tableData = useMemo<TableItem[]>(() => {
    const levels: RiskLevel[] = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'];
    return levels.map((level) => ({
      level,
      levelAlias: newLevelToAlias.get(level) ?? '',
      isActive: newLevelToActive.get(level) ?? true,
    }));
  }, [newLevelToAlias, newLevelToActive]);

  const externalState: ExternalState = {
    handleSaveAlias,
    savingLevel,
    newLevelToAlias,
    newLevelToActive,
    committedLevelToAlias,
    committedLevelToActive,
  };

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
        onEdit={(rowKey, newValue) => {
          if (newValue.levelAlias !== undefined) {
            handleUpdateAlias(rowKey as RiskLevel, newValue.levelAlias ?? '');
          }
          if (newValue.isActive !== undefined) {
            handleUpdateActive(rowKey as RiskLevel, newValue.isActive ?? true);
          }
        }}
        data={{ items: tableData }}
        pagination={false}
        toolsOptions={{ reload: false, setting: false, download: false }}
        externalState={externalState}
      />
    </SettingsCard>
  );
};
