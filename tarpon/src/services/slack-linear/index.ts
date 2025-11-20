import { WebClient } from '@slack/web-api'
import { LinearClient } from '@linear/sdk'
import { backOff, BackoffOptions } from 'exponential-backoff'
import { logger } from '@/core/logger'
import { getSecret } from '@/utils/secrets-manager'
import { traceable } from '@/core/xray'
import { SlackWebhookEvent } from '@/@types/openapi-internal/SlackWebhookEvent'

export interface NewSlackWebhookEvent extends SlackWebhookEvent {
  event: {
    reaction: string
    item: {
      channel: string
      ts: string
    }
  }
}

export interface ProcessSlackWebhookResult {
  ticketId?: string
}

export interface UpdateLinearIssueParams {
  issueId: string
  projectName: string
  statusName: string
}

/**
 * Custom error class for retryable conditions
 */
@traceable
class RetryableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryableError'
  }
}

@traceable
export class SlackLinearService {
  private slackClient: WebClient | null = null
  private linearClient: LinearClient | null = null

  private async getSlackClient(): Promise<WebClient> {
    if (!this.slackClient) {
      const slackCreds = await getSecret<{ token: string }>('slackCreds')
      this.slackClient = new WebClient(slackCreds.token)
    }
    return this.slackClient
  }

  private async getLinearClient(): Promise<LinearClient> {
    if (!this.linearClient) {
      const linearToken = await getSecret<{ apiKey: string }>('linear')
      this.linearClient = new LinearClient({ apiKey: linearToken.apiKey })
    }
    return this.linearClient
  }

  /**
   * Extracts ticket ID from Slack webhook event
   * Handles retry logic for fetching messages and thread replies
   */
  async extractTicketIdFromSlackEvent(
    event: SlackWebhookEvent
  ): Promise<string | undefined> {
    if (event.type !== 'event_callback' || !event.event) {
      return undefined
    }

    const eventData = event.event
    const channel = eventData.item?.channel
    const ts = eventData.item?.ts

    if (!channel || !ts) {
      return undefined
    }

    const slackClient = await this.getSlackClient()
    const threadId = await this.fetchThreadId(channel, ts, slackClient)

    if (!threadId) {
      return undefined
    }

    return await this.extractTicketIdFromThread(channel, threadId, slackClient)
  }

  /**
   * Fetches thread ID from Slack message with retry logic
   */
  private async fetchThreadId(
    channel: string,
    ts: string,
    slackClient: WebClient
  ): Promise<string | undefined> {
    const backoffOptions: BackoffOptions = {
      numOfAttempts: 5,
      maxDelay: 5 * 60 * 1000, // 5 minutes
      startingDelay: 30 * 1000, // 30 seconds
      timeMultiple: 2, // exponential backoff
      retry: (error) => {
        if (error instanceof RetryableError) {
          logger.info(`Retrying to fetch thread ID: ${error.message}`)
          return true
        }
        return false
      },
    }

    try {
      return await backOff(async () => {
        const result = await slackClient.conversations.history({
          channel,
          latest: ts,
          inclusive: true,
          limit: 1,
        })

        if (result.messages && result.messages.length > 0) {
          const message = result.messages[0]
          const threadId = message.thread_ts || message.ts

          // If thread_ts is found, return it (no retry needed)
          if (message.thread_ts) {
            return threadId
          }

          // If thread_ts not found, throw retryable error
          throw new RetryableError('thread_ts not found yet')
        }

        // No messages found, throw retryable error
        throw new RetryableError('No messages found')
      }, backoffOptions)
    } catch (error) {
      if (error instanceof RetryableError) {
        logger.warn('Failed to fetch thread ID after retries', { error })
        return undefined
      }
      throw error
    }
  }

  /**
   * Extracts ticket ID from Slack thread replies
   * Looks for messages from Linear app (app_id: A04RHP43AKH)
   */
  private async extractTicketIdFromThread(
    channel: string,
    threadId: string,
    slackClient: WebClient
  ): Promise<string | undefined> {
    const backoffOptions: BackoffOptions = {
      numOfAttempts: 5,
      maxDelay: 5 * 60 * 1000, // 5 minutes
      startingDelay: 60 * 1000, // 1 minute (fixed delay)
      timeMultiple: 1, // fixed backoff (no exponential)
      retry: (error, attemptNumber) => {
        if (error instanceof RetryableError) {
          logger.info(`Ticket ID not found, retrying... (${attemptNumber}/5)`, {
            attemptNumber,
            error: error.message,
          })
          return true
        }
        return false
      },
    }

    try {
      return await backOff(async () => {
        const threadResult = await slackClient.conversations.replies({
          channel,
          ts: threadId,
        })

        // Find reply from Linear app (app_id: A04RHP43AKH)
        const reply = threadResult.messages?.find(
          (message) => message.app_id === 'A04RHP43AKH'
        )

        // Extract ticket ID from attachment URL
        const attachment = reply?.attachments?.[0]?.from_url
        const ticketIdMatch = attachment?.match(/issue\/FDT-(\d+)/)
        const ticketId = ticketIdMatch ? `FDT-${ticketIdMatch[1]}` : undefined

        if (ticketId) {
          logger.info(`Ticket ID extracted: ${ticketId}`, { ticketId })
          return ticketId
        }

        // Ticket ID not found, throw retryable error
        throw new RetryableError('Ticket ID not found in thread replies')
      }, backoffOptions)
    } catch (error) {
      if (error instanceof RetryableError) {
        logger.warn('Failed to extract ticket ID after retries', { error })
        return undefined
      }
      throw error
    }
  }

  /**
   * Updates a Linear issue with project and status
   */
  private async updateLinearIssue(
    params: UpdateLinearIssueParams
  ): Promise<void> {
    const { issueId, projectName, statusName } = params
    const linearClient = await this.getLinearClient()

    // Get the issue to find its team
    const issue = await linearClient.issue(issueId)
    const issueTeam = await issue.team
    const teamId = issueTeam?.id

    if (!teamId) {
      throw new Error(`Issue team not found for issue ${issueId}`)
    }

    // Filter workflow states by the issue's team
    const statuses = await linearClient.workflowStates({
      filter: {
        team: { id: { eq: teamId } },
      },
    })

    const foundStatus = statuses.nodes.find(
      (s) => s.name.toLowerCase() === statusName.toLowerCase()
    )

    if (!foundStatus) {
      throw new Error(`Status "${statusName}" not found for team ${teamId}`)
    }

    // Get all projects and filter by team
    const allProjects = await linearClient.projects().then((p) => p.nodes)

    // Find the project and verify it belongs to the issue's team
    let project = allProjects.find((p) => p.name === projectName)

    if (project) {
      const projectTeams = await project.teams()
      const belongsToTeam = projectTeams.nodes.some(
        (team) => team.id === teamId
      )
      if (!belongsToTeam) {
        project = undefined
      }
    }

    if (!project) {
      throw new Error(`Project "${projectName}" not found for team ${teamId}`)
    }

    // Update the issue
    await linearClient.updateIssue(issueId, {
      projectId: project.id,
      stateId: foundStatus.id,
    })

    logger.info(`Updated Linear issue ${issueId}`, {
      issueId,
      projectId: project.id,
      stateId: foundStatus.id,
    })
  }

  /**
   * Processes a Slack webhook event and optionally updates Linear issue
   */
  async processSlackWebhook(
    event: SlackWebhookEvent,
    options?: {
      updateLinearIssue?: UpdateLinearIssueParams
    }
  ): Promise<ProcessSlackWebhookResult> {
    const ticketId = await this.extractTicketIdFromSlackEvent(event)

    if (options?.updateLinearIssue && ticketId) {
      await this.updateLinearIssue({
        ...options.updateLinearIssue,
        issueId: ticketId,
      })
    }

    return { ticketId }
  }
}
