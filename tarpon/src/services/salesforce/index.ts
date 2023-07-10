import fetch, { Headers } from 'node-fetch'
import { Configuration, OpenAIApi } from 'openai'
import { NotFound } from 'http-errors'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { SalesforceAccountResponse } from '@/@types/openapi-internal/SalesforceAccountResponse'
import { logger } from '@/core/logger'
import { getSecret } from '@/utils/secrets-manager'
import { traceable } from '@/core/xray'

const FLAGRIGHT_SALESFORCE_DEV_URL =
  'https://flagright-dev-ed.develop.my.salesforce.com'
const OPENAI_MAX_TOKENS = 1000

type Account = {
  Id: string
  Type: string
  Industry: string
  AnnualRevenue: string
}

type FeedComment = {
  Id: string
  CommentBody: string
  CreatedById: string
  CreatedDate: string
}

type Note = {
  Id: string
  Title: string
  CreatedById: string
  CreatedDate: string
  Body: string
}

type EmailMessage = {
  Id: string
  FromAddress: string
  ToAddress: string
  Subject: string
  TextBody: string
  CreatedDate: string
}

type User = {
  Id: string
  Name: string
}

type Response<T> = {
  records: T[]
}

const OPENAI_CREDENTIALS_SECRET_ARN = process.env
  .OPENAI_CREDENTIALS_SECRET_ARN as string

@traceable
export class SalesforceService {
  token!: string
  constructor(token: string) {
    this.token = token
  }
  public async getAccount(
    user: InternalBusinessUser | InternalConsumerUser
  ): Promise<SalesforceAccountResponse> {
    const configuration = new Configuration({
      apiKey: (
        await getSecret<{ apiKey: string }>(OPENAI_CREDENTIALS_SECRET_ARN)
      ).apiKey,
    })
    const openai = new OpenAIApi(configuration)

    const accountResponse: Response<Account> = await this.execute(
      `SELECT Id, Type, Industry, AnnualRevenue from Account WHERE Name = '${getAccountName(
        user
      )}'`
    )

    if (!accountResponse?.records || accountResponse.records.length === 0) {
      throw new NotFound('Salesforce account not found for user')
    }
    const account = accountResponse.records[0]
    const id = account.Id
    const commentsPromise = this.execute(
      `SELECT Id, CommentBody, CreatedDate, CreatedById from FeedComment WHERE ParentId = '${id}'`
    )
    const notesPromise = this.execute(
      `SELECT Id, Title, Body, CreatedById, CreatedDate from Note WHERE ParentId = '${id}'`
    )
    const emailsPromise = this.execute(
      `SELECT Id, Subject, FromAddress, ToAddress, TextBody, CreatedDate, CreatedById From EmailMessage WHERE RelatedToId = '${id}'`
    )

    const notesResponse: Response<Note> = await notesPromise
    const commentsResponse: Response<FeedComment> = await commentsPromise
    const emailsResponse: Response<EmailMessage> = await emailsPromise

    const notes = notesResponse.records
    const comments = commentsResponse.records
    const emails = emailsResponse.records

    const createdByIds = [
      ...notes.map((n) => n.CreatedById),
      ...comments.map((n) => n.CreatedById),
    ]
    const userResponse: Response<User> = await this.execute(
      `SELECT Id, Name from User WHERE Id IN ('${createdByIds.join("','")}')`
    )
    const userMap = new Map<string, string>()

    userResponse.records.forEach((u) => {
      userMap.set(u.Id, u.Name)
    })
    const response: SalesforceAccountResponse = {
      account: {
        id: account.Id,
        annualRevenue: account.AnnualRevenue,
        type: account.Type,
        industry: account.Industry,
        link: `${FLAGRIGHT_SALESFORCE_DEV_URL}/lightning/r/Account/${account.Id}/view`,
      },
      comments: comments.map((c) => ({
        user: userMap.get(c.CreatedById),
        body: c.CommentBody,
        createdAt: c.CreatedDate,
        link: `${FLAGRIGHT_SALESFORCE_DEV_URL}/lightning/r/Account/${account.Id}/view`,
      })),
      notes: notes.map((n) => ({
        user: userMap.get(n.CreatedById),
        body: n.Body,
        title: n.Title,
        createdAt: n.CreatedDate,
        link: `${FLAGRIGHT_SALESFORCE_DEV_URL}/lightning/r/Note/${n.Id}/view`,
      })),
      emails: emails.map((e) => ({
        subject: e.Subject || 'No Subject',
        body: e.TextBody || 'No Content',
        createdAt: e.CreatedDate,
        to: e.ToAddress?.split(';').map((e) => e.trim()),
        _from: e.FromAddress,
        link: `${FLAGRIGHT_SALESFORCE_DEV_URL}/lightning/r/EmailMessage/${e.Id}/view`,
      })),
    }

    try {
      const completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            content: `Summarize the following information representing a CRM account for Flagright of their customer ${getAccountName(
              user
            )}. The output format is a JSON object with keys of "good", "bad" and "neutral" which each have a string value representing a summary of the "good", "bad" and "neutral" points. Here is the input JSON: ${JSON.stringify(
              response
            )}`,
            role: 'system',
          },
        ],
        max_tokens: OPENAI_MAX_TOKENS,
      })

      const output = completion.data.choices[0].message?.content
      if (output && response.account) {
        return {
          ...response,
          account: { ...response.account, summary: JSON.parse(output) },
        }
      }
    } catch (e) {
      logger.warn(e)
    }

    return response
  }

  async execute(query: string) {
    const response = await fetch(
      `${FLAGRIGHT_SALESFORCE_DEV_URL}/services/data/v57.0/query/?q=${encodeURIComponent(
        query
      )}`,
      {
        headers: new Headers({
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        }),
      }
    )

    return response.json()
  }
}
function getAccountName(
  user: InternalBusinessUser | InternalConsumerUser
): string {
  if (user.type === 'CONSUMER') {
    const consumer = user as InternalConsumerUser
    return `${consumer.userDetails?.name.firstName} ${consumer.userDetails?.name.lastName}`
  }
  const business = user as InternalBusinessUser
  return business.legalEntity.companyGeneralDetails.legalName.trim()
}
