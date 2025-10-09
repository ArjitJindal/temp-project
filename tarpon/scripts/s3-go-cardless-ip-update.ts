import {
  S3Client,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'
import { initializeEnvVars, loadConfigEnv } from './migrations/utils/config'

process.env.ENV = 'prod:eu-2'

loadConfigEnv()
initializeEnvVars()

interface PolicyConfig {
  bucketName: string
  region: string
}

interface BucketPolicyStatement {
  Sid?: string
  Effect: string
  Principal: string | { [key: string]: string | string[] }
  Action: string | string[]
  Resource: string | string[]
  Condition?: {
    [key: string]: {
      [key: string]: string | string[]
    }
  }
}

interface BucketPolicy {
  Version: string
  Id?: string
  Statement: BucketPolicyStatement[]
}

class S3PolicyUpdater {
  private s3Client: S3Client
  private bucketName: string

  constructor(config: PolicyConfig) {
    this.bucketName = config.bucketName
    this.s3Client = new S3Client({
      region: config.region,
    })
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipRegex.test(ip)
  }

  /**
   * Get current bucket policy
   */
  async getCurrentPolicy(): Promise<BucketPolicy | null> {
    try {
      console.log(`📋 Getting current bucket policy for ${this.bucketName}...`)

      const command = new GetBucketPolicyCommand({
        Bucket: this.bucketName,
      })

      const response = await this.s3Client.send(command)

      if (response.Policy) {
        const policy = JSON.parse(response.Policy) as BucketPolicy
        console.log('✅ Current policy retrieved')
        return policy
      } else {
        console.log('⚠️  No existing policy found')
        return null
      }
    } catch (error: any) {
      if (error.name === 'NoSuchBucketPolicy') {
        console.log('⚠️  No existing bucket policy found')
        return null
      }
      console.error('❌ Error getting bucket policy:', error)
      throw error
    }
  }

  /**
   * Create a new bucket policy with IP restriction
   */
  createNewPolicy(ipAddress: string): BucketPolicy {
    return {
      Version: '2012-10-17',
      Id: 'UploadFromSpecificIP',
      Statement: [
        {
          Sid: 'AllowUploadFromSpecificIP',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:PutObject', 's3:PutObjectAcl'],
          Resource: `arn:aws:s3:::${this.bucketName}/*`,
          Condition: {
            IpAddress: {
              'aws:SourceIp': `${ipAddress}/32`,
            },
          },
        },
        {
          Sid: 'AllowListBucketFromSpecificIP',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:ListBucket',
          Resource: `arn:aws:s3:::${this.bucketName}`,
          Condition: {
            IpAddress: {
              'aws:SourceIp': `${ipAddress}/32`,
            },
          },
        },
      ],
    }
  }

  /**
   * Update IP address in existing policy
   */
  updatePolicyIP(policy: BucketPolicy, newIP: string): BucketPolicy {
    const updatedPolicy = JSON.parse(JSON.stringify(policy)) // Deep clone

    let ipUpdated = false

    // Update all statements that have IP conditions
    updatedPolicy.Statement.forEach((statement: BucketPolicyStatement) => {
      if (statement.Condition?.IpAddress?.['aws:SourceIp']) {
        const currentIP = statement.Condition.IpAddress['aws:SourceIp']
        console.log(`🔄 Updating IpAddress from ${currentIP} to ${newIP}/32`)
        statement.Condition.IpAddress['aws:SourceIp'] = `${newIP}/32`
        ipUpdated = true
      }

      if (statement.Condition?.NotIpAddress?.['aws:SourceIp']) {
        const currentIP = statement.Condition.NotIpAddress['aws:SourceIp']
        console.log(`🔄 Updating NotIpAddress from ${currentIP} to ${newIP}/32`)
        statement.Condition.NotIpAddress['aws:SourceIp'] = `${newIP}/32`
        ipUpdated = true
      }
    })

    if (!ipUpdated) {
      console.log(
        '⚠️  No IP conditions found in existing policy. Creating new statements...'
      )
      // Add new statements with IP restrictions
      const newStatements = this.createNewPolicy(newIP).Statement
      updatedPolicy.Statement.push(...newStatements)
    }

    return updatedPolicy
  }

  /**
   * Apply the updated policy to the bucket
   */
  async applyPolicy(policy: BucketPolicy): Promise<void> {
    try {
      console.log('📝 Applying updated policy to bucket...')

      const command = new PutBucketPolicyCommand({
        Bucket: this.bucketName,
        Policy: JSON.stringify(policy, null, 2),
      })

      await this.s3Client.send(command)
      console.log('✅ Policy updated successfully!')
    } catch (error) {
      console.error('❌ Error applying policy:', error)
      throw error
    }
  }

  /**
   * Main method to update IP in bucket policy
   */
  async updateIPInPolicy(ipAddress: string): Promise<void> {
    try {
      console.log('🚀 Starting IP update process...')
      console.log('='.repeat(50))
      console.log(`📍 Target IP: ${ipAddress}`)

      // Validate IP format
      if (!this.isValidIP(ipAddress)) {
        throw new Error(`❌ Invalid IP address format: ${ipAddress}`)
      }

      // Get current policy
      const currentPolicy = await this.getCurrentPolicy()

      let updatedPolicy: BucketPolicy

      if (currentPolicy) {
        // Update existing policy
        console.log('🔄 Updating existing policy...')
        updatedPolicy = this.updatePolicyIP(currentPolicy, ipAddress)
      } else {
        // Create new policy
        console.log('🆕 Creating new policy...')
        updatedPolicy = this.createNewPolicy(ipAddress)
      }

      // Show policy preview
      console.log('\n📋 Updated Policy Preview:')
      console.log('-'.repeat(50))
      console.log(JSON.stringify(updatedPolicy, null, 2))
      console.log('-'.repeat(50))

      // Apply the policy
      await this.applyPolicy(updatedPolicy)

      console.log('\n' + '='.repeat(50))
      console.log('🎉 IP update completed successfully!')
      console.log(`📍 New IP: ${ipAddress}/32`)
      console.log(`🪣 Bucket: ${this.bucketName}`)
    } catch (error) {
      console.error('\n💥 IP update failed:', error)
      throw error
    }
  }

  /**
   * Get current IP from policy (for verification)
   */
  async getCurrentPolicyIP(): Promise<string | null> {
    try {
      const policy = await this.getCurrentPolicy()

      if (policy) {
        for (const statement of policy.Statement) {
          if (statement.Condition?.IpAddress?.['aws:SourceIp']) {
            const ipWithCIDR = statement.Condition.IpAddress[
              'aws:SourceIp'
            ] as string
            return ipWithCIDR.replace('/32', '')
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error getting current policy IP:', error)
      return null
    }
  }

  /**
   * Show current policy IP
   */
  async showCurrentPolicyIP(): Promise<void> {
    try {
      console.log('🔍 Checking current policy IP...')
      const policyIP = await this.getCurrentPolicyIP()

      if (policyIP) {
        console.log(`📋 Current policy IP: ${policyIP}`)
      } else {
        console.log('📋 No IP restriction found in current policy')
      }
    } catch (error) {
      console.error('❌ Error checking policy IP:', error)
    }
  }
}

// Function for programmatic use
export async function updateBucketPolicyIP(
  bucketName: string,
  region: string,
  ipAddress: string
): Promise<void> {
  const config: PolicyConfig = {
    bucketName,
    region,
  }

  const updater = new S3PolicyUpdater(config)
  await updater.updateIPInPolicy(ipAddress)
}

void updateBucketPolicyIP(
  'flagright-gocardless-data',
  'eu-west-2',
  '34.90.87.93'
)
