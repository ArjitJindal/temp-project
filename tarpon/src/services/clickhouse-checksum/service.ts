import { ClickHouseChecksumRepository } from './repository'
import {
  ClickHouseChecksum,
  ClickHouseTableChecksum,
  TenantSyncAnalysis,
  TableSyncResult,
} from '@/utils/clickhouse-checksum'

export class ClickHouseChecksumService {
  private readonly checksumUtil: ClickHouseChecksum
  private readonly repository: ClickHouseChecksumRepository

  constructor() {
    this.checksumUtil = new ClickHouseChecksum()
    this.repository = new ClickHouseChecksumRepository()
  }

  async analyzeTenantSyncNeeds(tenantId: string): Promise<TenantSyncAnalysis> {
    const storedChecksums = await this.repository.getStoredClickHouseChecksums(
      tenantId
    )
    return this.checksumUtil.analyzeTenantSyncNeeds(tenantId, storedChecksums)
  }

  async isClickHouseSyncNeeded(
    tenantId: string
  ): Promise<{ needsSync: boolean; reason?: string }> {
    const storedChecksums = await this.repository.getStoredClickHouseChecksums(
      tenantId
    )
    return this.checksumUtil.isClickHouseSyncNeeded(tenantId, storedChecksums)
  }

  async getTableSyncAnalysis(
    tenantId: string,
    tableName: string
  ): Promise<TableSyncResult | null> {
    const storedChecksums = await this.repository.getStoredClickHouseChecksums(
      tenantId
    )
    return this.checksumUtil.getTableSyncAnalysis(
      tenantId,
      tableName,
      storedChecksums
    )
  }

  async storeClickHouseChecksums(
    tenantId: string,
    checksums: ClickHouseTableChecksum[]
  ): Promise<void> {
    const syncChecksum = this.checksumUtil.createSyncChecksum(
      tenantId,
      checksums
    )
    await this.repository.storeClickHouseChecksums(syncChecksum)
  }

  async updateTableChecksums(
    tenantId: string,
    tableChecksums: ClickHouseTableChecksum[]
  ): Promise<void> {
    const storedChecksums = await this.repository.getStoredClickHouseChecksums(
      tenantId
    )
    const updatedChecksums = this.checksumUtil.updateTableChecksums(
      storedChecksums,
      tableChecksums
    )
    await this.storeClickHouseChecksums(tenantId, updatedChecksums)
  }

  async clearClickHouseChecksums(tenantId: string): Promise<void> {
    await this.repository.clearClickHouseChecksums(tenantId)
  }

  async clearTableChecksums(
    tenantId: string,
    tableNames: string[]
  ): Promise<void> {
    const storedChecksums = await this.repository.getStoredClickHouseChecksums(
      tenantId
    )
    const filteredChecksums = this.checksumUtil.clearTableChecksums(
      storedChecksums,
      tableNames
    )
    await this.storeClickHouseChecksums(tenantId, filteredChecksums)
  }

  async getClickHouseSyncStatus(
    tenantIds: string[]
  ): Promise<{ [tenantId: string]: { needsSync: boolean; reason?: string } }> {
    const status: {
      [tenantId: string]: { needsSync: boolean; reason?: string }
    } = {}

    await Promise.all(
      tenantIds.map(async (tenantId) => {
        status[tenantId] = await this.isClickHouseSyncNeeded(tenantId)
      })
    )

    return status
  }

  async getClickHouseSyncAnalysis(
    tenantIds: string[]
  ): Promise<{ [tenantId: string]: TenantSyncAnalysis }> {
    const analysis: { [tenantId: string]: TenantSyncAnalysis } = {}

    await Promise.all(
      tenantIds.map(async (tenantId) => {
        analysis[tenantId] = await this.analyzeTenantSyncNeeds(tenantId)
      })
    )

    return analysis
  }

  // Utility methods that don't require database access
  generateClickHouseTableChecksums(): ClickHouseTableChecksum[] {
    return this.checksumUtil.generateClickHouseTableChecksums()
  }

  generateSingleTableChecksum(
    tableName: string
  ): ClickHouseTableChecksum | null {
    return this.checksumUtil.generateSingleTableChecksum(tableName)
  }

  getSyncVersion(): string {
    return this.checksumUtil.getSyncVersion()
  }
}
