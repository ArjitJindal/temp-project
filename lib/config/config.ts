import { FlagrightRegion, Stage } from '../constants/deploy'

export const enum RetentionDays {
  /**
   * 1 day
   */
  ONE_DAY = 1,
  /**
   * 3 days
   */
  THREE_DAYS = 3,
  /**
   * 5 days
   */
  FIVE_DAYS = 5,
  /**
   * 1 week
   */
  ONE_WEEK = 7,
  /**
   * 2 weeks
   */
  TWO_WEEKS = 14,
  /**
   * 1 month
   */
  ONE_MONTH = 30,
  /**
   * 2 months
   */
  TWO_MONTHS = 60,
  /**
   * 3 months
   */
  THREE_MONTHS = 90,
  /**
   * 4 months
   */
  FOUR_MONTHS = 120,
  /**
   * 5 months
   */
  FIVE_MONTHS = 150,
  /**
   * 6 months
   */
  SIX_MONTHS = 180,
  /**
   * 1 year
   */
  ONE_YEAR = 365,
  /**
   * 13 months
   */
  THIRTEEN_MONTHS = 400,
  /**
   * 18 months
   */
  EIGHTEEN_MONTHS = 545,
  /**
   * 2 years
   */
  TWO_YEARS = 731,
  /**
   * 3 years
   */
  THREE_YEARS = 1096,
  /**
   * 5 years
   */
  FIVE_YEARS = 1827,
  /**
   * 6 years
   */
  SIX_YEARS = 2192,
  /**
   * 7 years
   */
  SEVEN_YEARS = 2557,
  /**
   * 8 years
   */
  EIGHT_YEARS = 2922,
  /**
   * 9 years
   */
  NINE_YEARS = 3288,
  /**
   * 10 years
   */
  TEN_YEARS = 3653,
  /**
   * Retain logs forever
   */
  INFINITE = 9999,
}

export const enum BillingMode {
  /**
   * Pay only for what you use. You don't configure Read/Write capacity units.
   */
  PAY_PER_REQUEST = 'PAY_PER_REQUEST',
  /**
   * Explicitly specified Read/Write capacity units.
   */
  PROVISIONED = 'PROVISIONED',
}

export interface TimeConversionOptions {
  /**
   * If `true`, conversions into a larger time unit (e.g. `Seconds` to `Minutes`) will fail if the result is not an
   * integer.
   *
   * @default true
   */
  readonly integral?: boolean
}

export declare class Duration {
  /**
   * Create a Duration representing an amount of milliseconds
   *
   * @param amount the amount of Milliseconds the `Duration` will represent.
   * @returns a new `Duration` representing `amount` ms.
   */
  static millis(amount: number): Duration
  /**
   * Create a Duration representing an amount of seconds
   *
   * @param amount the amount of Seconds the `Duration` will represent.
   * @returns a new `Duration` representing `amount` Seconds.
   */
  static seconds(amount: number): Duration
  /**
   * Create a Duration representing an amount of minutes
   *
   * @param amount the amount of Minutes the `Duration` will represent.
   * @returns a new `Duration` representing `amount` Minutes.
   */
  static minutes(amount: number): Duration
  /**
   * Create a Duration representing an amount of hours
   *
   * @param amount the amount of Hours the `Duration` will represent.
   * @returns a new `Duration` representing `amount` Hours.
   */
  static hours(amount: number): Duration
  /**
   * Create a Duration representing an amount of days
   *
   * @param amount the amount of Days the `Duration` will represent.
   * @returns a new `Duration` representing `amount` Days.
   */
  static days(amount: number): Duration
  /**
   * Parse a period formatted according to the ISO 8601 standard
   *
   * Days are the largest ISO duration supported, i.e.,
   * weeks, months, and years are not supported.
   *
   * @example
   * // This represents 1 day, 2 hours, 3 minutes, 4 seconds, and 567 milliseconds.
   * 'P1DT2H3M4.567S'
   *
   * @see https://www.iso.org/standard/70907.html
   * @param duration an ISO-formatted duration to be parsed.
   * @returns the parsed `Duration`.
   */
  static parse(duration: string): Duration
  private readonly amount
  private readonly unit
  private constructor()
  /**
   * Add two Durations together
   */
  plus(rhs: Duration): Duration
  /**
   * Substract two Durations together
   */
  minus(rhs: Duration): Duration
  /**
   * Return the total number of milliseconds in this Duration
   *
   * @returns the value of this `Duration` expressed in Milliseconds.
   */
  toMilliseconds(opts?: TimeConversionOptions): number
  /**
   * Return the total number of seconds in this Duration
   *
   * @returns the value of this `Duration` expressed in Seconds.
   */
  toSeconds(opts?: TimeConversionOptions): number
  /**
   * Return the total number of minutes in this Duration
   *
   * @returns the value of this `Duration` expressed in Minutes.
   */
  toMinutes(opts?: TimeConversionOptions): number
  /**
   * Return the total number of hours in this Duration
   *
   * @returns the value of this `Duration` expressed in Hours.
   */
  toHours(opts?: TimeConversionOptions): number
  /**
   * Return the total number of days in this Duration
   *
   * @returns the value of this `Duration` expressed in Days.
   */
  toDays(opts?: TimeConversionOptions): number
  /**
   * Return an ISO 8601 representation of this period
   *
   * @returns a string starting with 'P' describing the period
   * @see https://www.iso.org/standard/70907.html
   */
  toIsoString(): string
  /**
   * Turn this duration into a human-readable string
   */
  toHumanString(): string
  /**
   * Returns a string representation of this `Duration`
   *
   * This is is never the right function to use when you want to use the `Duration`
   * object in a template. Use `toSeconds()`, `toMinutes()`, `toDays()`, etc. instead.
   */
  toString(): string
  /**
   * Return the duration in a set of whole numbered time components, ordered from largest to smallest
   *
   * Only components != 0 will be returned.
   *
   * Can combine millis and seconds together for the benefit of toIsoString,
   * makes the logic in there simpler.
   */
  private components
  /**
   * Checks if duration is a token or a resolvable object
   */
  isUnresolved(): boolean
  /**
   * Returns unit of the duration
   */
  unitLabel(): string
  /**
   * Returns stringified number of duration
   */
  formatTokenToNumber(): string
}

export interface Environment {
  /**
   * The AWS account ID for this environment.
   *
   * This can be either a concrete value such as `585191031104` or `Aws.ACCOUNT_ID` which
   * indicates that account ID will only be determined during deployment (it
   * will resolve to the CloudFormation intrinsic `{"Ref":"AWS::AccountId"}`).
   * Note that certain features, such as cross-stack references and
   * environmental context providers require concrete region information and
   * will cause this stack to emit synthesis errors.
   *
   * @default Aws.ACCOUNT_ID which means that the stack will be account-agnostic.
   */
  readonly account?: string
  /**
   * The AWS region for this environment.
   *
   * This can be either a concrete value such as `eu-west-2` or `Aws.REGION`
   * which indicates that account ID will only be determined during deployment
   * (it will resolve to the CloudFormation intrinsic `{"Ref":"AWS::Region"}`).
   * Note that certain features, such as cross-stack references and
   * environmental context providers require concrete region information and
   * will cause this stack to emit synthesis errors.
   *
   * @default Aws.REGION which means that the stack will be region-agnostic.
   */
  readonly region?: string
}

type ApiGatewayConfig = {
  CACHE?: {
    CAPACITY: '0.5' | '1.6' | '6.1' | '13.5' | '28.4' | '58.2' | '118' | '237'
    TTL: Duration
  }
}

export type FlagrightCPUArchitecture = 'arm64' | 'x86_64'

export type Config = {
  stage: Stage
  region?: FlagrightRegion
  env: Environment
  resource: {
    CLOUD_WATCH: {
      logRetention: RetentionDays
    }
    DYNAMO_WRITE_CAPACITY_THRESHOLD?: number
    FARGATE_BATCH_JOB_CONTAINER: {
      CPU: number
      MEMORY_LIMIT: number
      ARCHITECTURE?: FlagrightCPUArchitecture
    }
    DYNAMODB: {
      READ_CAPACITY?: number
      WRITE_CAPACITY?: number
      BILLING_MODE?: BillingMode
    }
    PUBLIC_API_GATEWAY: ApiGatewayConfig
    CONSOLE_API_GATEWAY: ApiGatewayConfig
    LAMBDA_DEFAULT: {
      MEMORY_SIZE: number
    }
    BATCH_JOB_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    INCOMING_WEBHOOK_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    SANCTIONS_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    CRON_JOB_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    ASYNC_RULES_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    // Also used in sandbox for initial setup
    API_KEY_GENERATOR_LAMBDA?: {
      MEMORY_SIZE: number
    }
    // API Key authorizer result is cached for 3600 seconds
    API_KEY_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
    }
    // JWT authorizer result is cached for 600 seconds
    JWT_AUTHORIZER_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
    }
    TRANSACTION_LAMBDA: {
      MAX_PROVISIONED_CONCURRENCY: number
      MIN_PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
      AUTO_SCALING_ENABLED?: boolean
    }
    TRANSACTION_AGGREGATION_LAMBDA: {
      MEMORY_SIZE?: number
      PROVISIONED_CONCURRENCY?: number
    }
    TRANSACTION_AGGREGATION_MAX_CONCURRENCY: number
    REQUEST_LOGGER_LAMBDA: {
      MEMORY_SIZE?: number
      PROVISIONED_CONCURRENCY?: number
      BATCH_SIZE?: number
    }
    USER_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    TARPON_CHANGE_CAPTURE_LAMBDA?: {
      MEMORY_SIZE?: number
      PROVISIONED_CONCURRENCY?: number
    }
    TRANSACTIONS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    USERS_VIEW_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    TENANT_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    DASHBOARD_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    CASE_LAMBDA: {
      PROVISIONED_CONCURRENCY: number
      MEMORY_SIZE?: number
    }
    COPILOT_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    LAMBDA_VPC_ENABLED?: boolean
    INSPECTOR_ENABLED: boolean
    ATLAS_SEARCH_ENABLED?: boolean
    MONGO_DB_TRIGGER_LAMBDA?: {
      MEMORY_SIZE?: number
      PROVISIONED_CONCURRENCY?: number
    }
    DYNAMO_DB_TRIGGER_LAMBDA?: {
      MEMORY_SIZE?: number
    }
    CLOUDWATCH_LOGS_INGESTION?: {
      ENABLED?: boolean
      FIREHOSE_BUFFER_INTERVAL_SECONDS?: number
      FIREHOSE_BUFFER_SIZE_MB?: number
      LOG_GROUP_NAME?: string
      FILTER_PATTERN?: string
    }
    CLOUDWATCH_LOGS_S3_EXPORT?: {
      ENABLED?: boolean
    }
  }
  viper?: {
    ADMIN_EMAILS: string[]
    CREATE_METASTORE: boolean
    CREATE_VPC: boolean
  }
  budgets: {
    EC2: number
    S3: number
    LAMBDA: number
    DYNAMODB: number
    CLOUDWATCH: number
    SQS: number
    KINESIS: number
    VPC: number
    GUARDDUTY: number
    SECRETS_MANAGER: number
    EMR: number
    GLUE: number
  }
  clickhouse?: {
    awsPrivateLinkEndpointName?: string
    ipAccess?: { source: string; description: string }[]
    minTotalMemoryGb?: number
    maxTotalMemoryGb?: number
    numReplicas?: number
  }
  application: {
    MONGO_ATLAS_PROJECT?: string
    MONGO_ATLAS_CLUSTER?: string
    MONGO_EVENT_TRIGGER_RULE_ID?: string // We need to first generate the event trigger rule id and then paste it here
    DEV_CERTIFICATE_ARN?: string
    AUTH0_CUSTOM_CNAME?: string
    AUTH0_DOMAIN: string
    AUTH0_AUDIENCE: string
    CONSOLE_URI: string
    MAXIMUM_ALLOWED_EXPORT_SIZE: number
    NODE_ENV?: string
    ZENDUTY_WEBHOOK_URL?: string
    POSTMAN_SECRET_ARN?: string
    SLACK_CLIENT_ID: string
    SLACK_CLIENT_SECRET: string
    SLACK_REDIRECT_URI: string
    WEBHOOK_REQUEST_TIMEOUT_SEC: number
    INTEGRATION_TEST_API_KEY_ID?: string
    POSTMAN_COLLECTION_ID?: string
    GOOGLE_SHEETS_CLIENT_EMAIL: string
    API_USAGE_GOOGLE_SHEET_ID: string
    POSTHOG_API_KEY?: string
    POSTHOG_HOST?: string
    FINCEN_SFTP_IP?: string
    FINCEN_SFTP_PORT?: string
  }
  opensearch: {
    deploy: boolean
    dataNodes: number
    dataNodeInstanceType: string
    volumeSize: number
  }
}
