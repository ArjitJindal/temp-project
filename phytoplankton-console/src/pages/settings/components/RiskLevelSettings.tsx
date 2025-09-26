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
  levelAlias: string | undefined;
  isActive: boolean;
}

interface ExternalState {
  handleSaveAlias: (level: RiskLevel) => void;
  savingLevel: RiskLevel | null;
  newLevelToAlias: Map<RiskLevel | undefined, string>;
  savedLevelToAlias: Map<RiskLevel | undefined, string>;
  newLevelToActive: Map<RiskLevel | undefined, boolean>;
  savedLevelToActive: Map<RiskLevel | undefined, boolean>;
}

// Local payload type to include status alongside alias
type RiskLevelAliasPayload = { level: RiskLevel; isActive: boolean; alias?: string };

const helper = new ColumnHelper<TableItem>();

const columns = helper.list([
  helper.simple({ key: 'level', title: 'Level', defaultWidth: 100 }),
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
        savedLevelToAlias,
        newLevelToActive,
        savedLevelToActive,
      } = context.external as ExternalState;

      const savedAlias = savedLevelToAlias.get(item.level) ?? '';
      const nextAlias = newLevelToAlias.get(item.level) ?? '';
      const savedActive = savedLevelToActive.get(item.level) ?? true;
      const nextActive = newLevelToActive.get(item.level) ?? true;

      const noChanges = savedAlias === nextAlias && savedActive === nextActive;

      return (
        <Button
          type="PRIMARY"
          onClick={() => handleSaveAlias(item.level)}
          isDisabled={!!savingLevel || noChanges}
          isLoading={item.level === savingLevel}
          requiredResources={['write:::settings/risk-scoring/risk-levels-alias/*']}
        >
          Update
        </Button>
      );
    },
  }),
]);

const RISK_LEVELS: RiskLevel[] = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'];

export const RiskLevelSettings: React.FC = () => {
  const settings = useSettings();
  const [savingLevel, setSavingLevel] = useState<RiskLevel | null>(null);

  // === Alias maps ===
  const levelToAlias = useMemo<Map<RiskLevel | undefined, string>>(
    () =>
      new Map(
        (settings.riskLevelAlias || []).map((entry: RiskLevelAlias & any) => [
          entry.level,
          entry.alias ?? '',
        ]),
      ),
    [settings.riskLevelAlias],
  );
  const [commitedLevelToAlias, setCommitedLevelToAlias] =
    useState<Map<RiskLevel | undefined, string>>(new Map([...levelToAlias]));
  const savedLevelToAlias = useMemo(
    () => new Map([...levelToAlias, ...commitedLevelToAlias]),
    [levelToAlias, commitedLevelToAlias],
  );
  const [newLevelToAlias, setNewLevelToAlias] =
    useState<Map<RiskLevel | undefined, string>>(new Map([...levelToAlias]));

  // === Status maps ===
  // Prefer status from riskLevelAlias entries; fallback to settings.riskLevelStatus; otherwise default true.
  const levelToActive = useMemo<Map<RiskLevel | undefined, boolean>>(() => {
    const fromAlias = new Map<RiskLevel | undefined, boolean>(
      (settings.riskLevelAlias || []).map((e: any) => [e.level, e.isActive ?? true]),
    );
    if (fromAlias.size) return fromAlias;

    const fromStatus = new Map<RiskLevel | undefined, boolean>(
      ((settings as any).riskLevelStatus || []).map((e: any) => [e.level, !!e.isActive]),
    );
    if (fromStatus.size) return fromStatus;

    return new Map<RiskLevel | undefined, boolean>(RISK_LEVELS.map((lvl) => [lvl, true]));
  }, [settings.riskLevelAlias, (settings as any).riskLevelStatus]);

  const [commitedLevelToActive, setCommitedLevelToActive] =
    useState<Map<RiskLevel | undefined, boolean>>(new Map([...levelToActive]));
  const savedLevelToActive = useMemo(
    () => new Map([...levelToActive, ...commitedLevelToActive]),
    [levelToActive, commitedLevelToActive],
  );
  const [newLevelToActive, setNewLevelToActive] =
    useState<Map<RiskLevel | undefined, boolean>>(new Map([...levelToActive]));

  // Edit handlers
  const handleUpdateAlias = useCallback(
    (level: RiskLevel, newAlias: string) => {
      setNewLevelToAlias((prev) => new Map(prev).set(level, newAlias.trim()));
    },
    [],
  );
  const handleUpdateActive = useCallback((level: RiskLevel, isActive: boolean) => {
    setNewLevelToActive((prev) => new Map(prev).set(level, !!isActive));
  }, []);

  const mutateTenantSettings = useUpdateTenantSettings();

  // Save ONLY the edited row (alias + isActive sent together)
  const handleSaveAlias = useCallback(
    async (level: RiskLevel) => {
      setSavingLevel(level);
      try {
        const alias = (newLevelToAlias.get(level) || '').trim();
        const isActive = newLevelToActive.get(level) ?? true;

        const item: RiskLevelAliasPayload = { level, isActive };
        if (alias) item.alias = alias; // alias optional; status always present
        console.log('item', item);
        // send only the updated row; include isActive in the item
        await mutateTenantSettings.mutateAsync({
          riskLevelAlias: [item] as any, // cast if RiskLevelAlias doesn't include isActive in typings
        });

        // update committed maps locally for this level
        setCommitedLevelToAlias((prev) => new Map(prev).set(level, alias));
        setCommitedLevelToActive((prev) => new Map(prev).set(level, isActive));
      } finally {
        setSavingLevel(null);
      }
    },
    [newLevelToAlias, newLevelToActive, mutateTenantSettings],
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

  const externalState: ExternalState = {
    savingLevel,
    newLevelToAlias,
    savedLevelToAlias,
    newLevelToActive,
    savedLevelToActive,
    handleSaveAlias,
  };

  return (
    <SettingsCard
      title="Risk levels alias"
      description="Configure risk levels display name and status in console."
      minRequiredResources={['read:::settings/risk-scoring/risk-levels-alias/*']}
    >
      <Table<TableItem>
        sizingMode="FULL_WIDTH"
        rowKey="level"
        columns={columns}
        onEdit={(rowKey, newValue) => {
          const level = rowKey as RiskLevel;
          if ('levelAlias' in newValue) {
            handleUpdateAlias(level, newValue.levelAlias ?? '');
          }
          if ('isActive' in newValue) {
            handleUpdateActive(level, !!newValue.isActive);
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
