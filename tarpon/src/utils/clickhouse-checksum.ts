import { generateChecksum } from './object'
import { ClickHouseTables } from './clickhouse/definition'

export interface ClickHouseTableChecksum {
  tableName: string
  checksum: string
  lastUpdated: number
}

export interface ClickHouseSyncChecksum {
  tenantId: string
  checksums: ClickHouseTableChecksum[]
  lastSyncTimestamp: number
  version: string
}

export interface TableSyncResult {
  tableName: string
  needsSync: boolean
  reason?: string
  action: 'skip' | 'sync' | 'create' | 'remove'
}

export interface TenantSyncAnalysis {
  tenantId: string
  needsSync: boolean
  tablesToSync: string[]
  tablesToCreate: string[]
  tablesToRemove: string[]
  tablesToSkip: string[]
  reasons: { [tableName: string]: string }
}

export class ClickHouseChecksum {
  private readonly CLICKHOUSE_SYNC_VERSION = '1.0.0'

  generateClickHouseTableChecksums(): ClickHouseTableChecksum[] {
    const checksums: ClickHouseTableChecksum[] = []
    const timestamp = Date.now()

    for (const table of ClickHouseTables) {
      const tableDefinition = {
        table: table.table,
        idColumn: table.idColumn,
        timestampColumn: table.timestampColumn,
        materializedColumns: table.materializedColumns || [],
        indexes: table.indexes || [],
        engine: table.engine,
        versionColumn: table.versionColumn,
        primaryKey: table.primaryKey,
        orderBy: table.orderBy,
        partitionBy: table.partitionBy,
        mongoIdColumn: table.mongoIdColumn,
        optimize: table.optimize,
        materializedViews: table.materializedViews || [],
        projections: table.projections || [],
      }

      const checksum = generateChecksum(tableDefinition)
      checksums.push({
        tableName: table.table,
        checksum,
        lastUpdated: timestamp,
      })
    }

    return checksums
  }

  generateSingleTableChecksum(
    tableName: string
  ): ClickHouseTableChecksum | null {
    const table = ClickHouseTables.find((t) => t.table === tableName)
    if (!table) {
      return null
    }

    const tableDefinition = {
      table: table.table,
      idColumn: table.idColumn,
      timestampColumn: table.timestampColumn,
      materializedColumns: table.materializedColumns || [],
      indexes: table.indexes || [],
      engine: table.engine,
      versionColumn: table.versionColumn,
      primaryKey: table.primaryKey,
      orderBy: table.orderBy,
      partitionBy: table.partitionBy,
      mongoIdColumn: table.mongoIdColumn,
      optimize: table.optimize,
      materializedViews: table.materializedViews || [],
      projections: table.projections || [],
    }

    const checksum = generateChecksum(tableDefinition)
    return {
      tableName: table.table,
      checksum,
      lastUpdated: Date.now(),
    }
  }

  analyzeTenantSyncNeeds(
    tenantId: string,
    storedChecksums: ClickHouseSyncChecksum | null
  ): TenantSyncAnalysis {
    const currentChecksums = this.generateClickHouseTableChecksums()

    const analysis: TenantSyncAnalysis = {
      tenantId,
      needsSync: false,
      tablesToSync: [],
      tablesToCreate: [],
      tablesToRemove: [],
      tablesToSkip: [],
      reasons: {},
    }

    if (!storedChecksums) {
      analysis.needsSync = true
      analysis.tablesToCreate = currentChecksums.map((c) => c.tableName)
      analysis.reasons = Object.fromEntries(
        currentChecksums.map((c) => [c.tableName, 'No stored checksums found'])
      )
      return analysis
    }

    if (storedChecksums.version !== this.CLICKHOUSE_SYNC_VERSION) {
      analysis.needsSync = true
      analysis.tablesToSync = currentChecksums.map((c) => c.tableName)
      analysis.reasons = Object.fromEntries(
        currentChecksums.map((c) => [c.tableName, 'Schema version mismatch'])
      )
      return analysis
    }

    const currentChecksumMap = new Map(
      currentChecksums.map((c) => [c.tableName, c.checksum])
    )
    const storedChecksumMap = new Map(
      storedChecksums.checksums.map((c) => [c.tableName, c.checksum])
    )

    for (const [tableName, currentChecksum] of currentChecksumMap) {
      const storedChecksum = storedChecksumMap.get(tableName)

      if (!storedChecksum) {
        analysis.needsSync = true
        analysis.tablesToCreate.push(tableName)
        analysis.reasons[tableName] = 'New table detected'
      } else if (storedChecksum !== currentChecksum) {
        analysis.needsSync = true
        analysis.tablesToSync.push(tableName)
        analysis.reasons[tableName] = 'Table definition changed'
      } else {
        analysis.tablesToSkip.push(tableName)
      }
    }

    for (const [tableName] of storedChecksumMap) {
      if (!currentChecksumMap.has(tableName)) {
        analysis.needsSync = true
        analysis.tablesToRemove.push(tableName)
        analysis.reasons[tableName] = 'Table removed from definitions'
      }
    }

    return analysis
  }

  isClickHouseSyncNeeded(
    tenantId: string,
    storedChecksums: ClickHouseSyncChecksum | null
  ): { needsSync: boolean; reason?: string } {
    const analysis = this.analyzeTenantSyncNeeds(tenantId, storedChecksums)

    if (!analysis.needsSync) {
      return { needsSync: false }
    }

    const reasons = Object.values(analysis.reasons)
    const uniqueReasons = [...new Set(reasons)]
    const reason =
      uniqueReasons.length === 1
        ? uniqueReasons[0]
        : `Multiple changes: ${uniqueReasons.join(', ')}`

    return { needsSync: true, reason }
  }

  getTableSyncAnalysis(
    tenantId: string,
    tableName: string,
    storedChecksums: ClickHouseSyncChecksum | null
  ): TableSyncResult | null {
    const analysis = this.analyzeTenantSyncNeeds(tenantId, storedChecksums)

    if (analysis.tablesToCreate.includes(tableName)) {
      return {
        tableName,
        needsSync: true,
        reason: analysis.reasons[tableName],
        action: 'create',
      }
    }

    if (analysis.tablesToSync.includes(tableName)) {
      return {
        tableName,
        needsSync: true,
        reason: analysis.reasons[tableName],
        action: 'sync',
      }
    }

    if (analysis.tablesToRemove.includes(tableName)) {
      return {
        tableName,
        needsSync: true,
        reason: analysis.reasons[tableName],
        action: 'remove',
      }
    }

    if (analysis.tablesToSkip.includes(tableName)) {
      return {
        tableName,
        needsSync: false,
        action: 'skip',
      }
    }

    return null
  }

  updateTableChecksums(
    storedChecksums: ClickHouseSyncChecksum | null,
    tableChecksums: ClickHouseTableChecksum[]
  ): ClickHouseTableChecksum[] {
    if (!storedChecksums) {
      return this.generateClickHouseTableChecksums()
    }

    const existingChecksumsMap = new Map(
      storedChecksums.checksums.map((c) => [c.tableName, c])
    )

    for (const newChecksum of tableChecksums) {
      existingChecksumsMap.set(newChecksum.tableName, newChecksum)
    }

    return Array.from(existingChecksumsMap.values())
  }

  clearTableChecksums(
    storedChecksums: ClickHouseSyncChecksum | null,
    tableNames: string[]
  ): ClickHouseTableChecksum[] {
    if (!storedChecksums) {
      return []
    }

    return storedChecksums.checksums.filter(
      (c) => !tableNames.includes(c.tableName)
    )
  }

  createSyncChecksum(
    tenantId: string,
    checksums: ClickHouseTableChecksum[]
  ): ClickHouseSyncChecksum {
    return {
      tenantId,
      checksums,
      lastSyncTimestamp: Date.now(),
      version: this.CLICKHOUSE_SYNC_VERSION,
    }
  }

  getSyncVersion(): string {
    return this.CLICKHOUSE_SYNC_VERSION
  }
}
