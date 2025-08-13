import { humanizeAuto } from '@flagright/lib/utils/humanize'
import compact from 'lodash/compact'
import uniq from 'lodash/uniq'
import {
  DEFAULT_RISK_LEVEL,
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils'
import pMap from 'p-map'
import { DynamoAccountsRepository } from '@/services/accounts/repository/dynamo'
import { EddReviewBatchJob } from '@/@types/batch-job'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { Person } from '@/@types/openapi-public/Person'
import { BatchJobRunner } from '@/services/batch-jobs/batch-job-runner-base'
import { CaseRepository } from '@/services/cases/repository'
import { CaseService } from '@/services/cases'
import { ClickhouseTransactionsRepository } from '@/services/rules-engine/repositories/clickhouse-repository'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getS3Client } from '@/utils/s3'
import { getSecretByName } from '@/utils/secrets-manager'
import { getAddress, getPersonName, getUserName } from '@/utils/helpers'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import { logger } from '@/core/logger'
import { ModelTier } from '@/utils/llms/base-service'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { SanctionsService } from '@/services/sanctions'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { ask } from '@/utils/llms'
import dayjs from '@/utils/dayjs'

export class EddReviewBatchJobRunner extends BatchJobRunner {
  private async getPerplexityResponse(prompt: string) {
    const perplexityApiKey = await getSecretByName('perplexity')
    const url = 'https://api.perplexity.ai/chat/completions'
    const headers = {
      Authorization: `Bearer ${perplexityApiKey.apiKey}`,
      'Content-Type': 'application/json',
    }

    // Define the request payload
    const payload = {
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
    }

    // Make the API call
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as {
      choices: { message: { content: string } }[]
    }

    const content = data.choices[0].message.content
    console.log(`Perplexity response: ${content}`)
    return content
      .replace(/```json\n|```/g, '')
      .replace(/```markdown\n|```/g, '')
  }

  protected async run(job: EddReviewBatchJob): Promise<void> {
    const { userId } = job.parameters
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    const userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })
    const sanctionsService = new SanctionsService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const caseRepository = new CaseRepository(tenantId, { mongoDb, dynamoDb })
    const user = await userRepository.getUserById(userId)

    if (!user) {
      return
    }

    const riskRepository = new RiskRepository(tenantId, { mongoDb, dynamoDb })

    const kycRiskScore = await riskRepository.getKrsScore(userId)
    const craRiskScore = await riskRepository.getDrsScore(userId)
    const riskLevels = await riskRepository.getRiskClassificationValues()

    const caseData = await caseRepository.getCaseById(job.parameters.caseId)

    let parentUser: InternalUser | null = null

    const parentUserId = user.linkedEntities?.parentUserId

    if (parentUserId) {
      parentUser = await userRepository.getUserById(parentUserId)
    }

    const childUsers: InternalUser[] = []

    if (parentUserId) {
      const parentUserChilds = await userRepository.getChildUsers(parentUserId)
      childUsers.push(...parentUserChilds)
    }

    const currentUserChilds = await userRepository.getChildUsers(userId)
    childUsers.push(...currentUserChilds)

    const sanctionHitIds = uniq(
      compact(
        user.hitRules?.flatMap((hitRule) =>
          hitRule.ruleHitMeta?.sanctionsDetails?.flatMap(
            (sd) => sd.sanctionHitIds
          )
        )
      )
    )

    const sanctionsHits =
      await sanctionsService.sanctionsHitsRepository.getHitsByIds(
        sanctionHitIds ?? []
      )

    const clickhouseClient = await getClickhouseClient(tenantId)

    const transactionsRepository = new ClickhouseTransactionsRepository(
      clickhouseClient,
      dynamoDb,
      tenantId
    )

    const transactionAmountData = await Promise.all(
      [
        userId,
        ...(parentUserId ? [parentUserId] : []),
        ...childUsers.map((u) => u.userId),
      ].map(async (userId) => {
        const amount = await transactionsRepository.getTotalOriginAmount({
          filterUserId: userId,
        })

        return {
          userId,
          amount,
        }
      })
    )

    const transactionAmountDataMap = transactionAmountData.reduce(
      (acc, curr) => {
        acc[curr.userId] = curr.amount
        return acc
      },
      {} as Record<string, number>
    )
    const sanctionsInformation = sanctionsHits.map((hit) => {
      const matchTypes = hit.entity.matchTypes
      const matchTypeDetails = hit.entity.matchTypeDetails
      return {
        hitId: hit.sanctionsHitId,
        matchTypes,
        matchTypeDetails,
        adverseMediaSources: hit.entity.mediaSources?.map((m) => ({
          media: m.media?.map((m) => ({ title: m.title })) ?? [],
          source: m.sourceName,
        })),
        sanctionsSources: hit.entity.sanctionsSources?.map((s) => ({
          source: s.sourceName,
          media: s.media?.map((m) => ({ title: m.title })) ?? [],
        })),
        screeningSources: hit.entity.screeningSources?.map((s) => ({
          source: s.sourceName,
          media: s.media?.map((m) => ({ title: m.title })) ?? [],
        })),
        pepSources: hit.entity.pepSources?.map((p) => ({
          source: p.sourceName,
          media: p.media?.map((m) => ({ title: m.title })) ?? [],
        })),
        otherSources: hit.entity.otherSources?.map((o) => ({
          type: o.type,
          value:
            o.value?.map((v) => ({
              media: v.media?.map((m) => ({ title: m.title })) ?? [],
            })) ?? [],
        })),
        pepStatus: hit.entity.pepStatus,
        isActivePep: hit.entity.isActivePep,
        isActiveSanctioned: hit.entity.isActiveSanctioned,
        isDeseased: hit.entity.isDeseased,
        profileImagesUrls: hit.entity.profileImagesUrls,
        dateOfBirths: hit.entity.dateOfBirths,
        provider: hit.entity.provider,
        addresses: hit.entity.addresses,
        normalizedAka: hit.entity.normalizedAka,
      }
    })

    const management: Record<
      string,
      { name: string; directors: Person[]; shareholders: Person[] }
    > = {}

    if (parentUser) {
      management[parentUser.userId] = {
        name: getUserName(parentUser),
        directors: parentUser.directors ?? [],
        shareholders: parentUser.shareHolders ?? [],
      }
    }

    if (childUsers.length > 0) {
      childUsers.forEach((user) => {
        management[user.userId] = {
          name: getUserName(user),
          directors: user.directors ?? [],
          shareholders: user.shareHolders ?? [],
        }
      })
    }

    management[user.userId] = {
      name: getUserName(user),
      directors: user.directors ?? [],
      shareholders: user.shareHolders ?? [],
    }

    const data = Object.entries(transactionAmountDataMap).map(
      ([userId, amount]) => {
        // Find the user object for this userId
        let u:
          | typeof user
          | typeof parentUser
          | (typeof childUsers)[0]
          | undefined

        if (user.userId === userId) {
          u = user
        } else if (parentUser && parentUser.userId === userId) {
          u = parentUser
        } else {
          u = childUsers.find((child) => child.userId === userId)
        }

        // Try to get the risk score for this user
        // Prefer krsScore if present, else craRiskScore?.drsScore
        let riskScore: number | undefined
        if (u && typeof u.krsScore === 'number') {
          riskScore = u.krsScore
        } else if (
          u &&
          typeof u.krsScore === 'object' &&
          u.krsScore !== null &&
          'krsScore' in u.krsScore
        ) {
          riskScore = (u.krsScore as any).krsScore
        } else if (craRiskScore?.drsScore !== undefined) {
          riskScore = craRiskScore.drsScore
        }

        // Risk level
        const riskLevel = getRiskLevelFromScore(
          riskLevels,
          riskScore || getRiskScoreFromLevel(riskLevels, DEFAULT_RISK_LEVEL)
        )

        return {
          userId,
          userName: u ? getUserName(u) : getUserName(user),
          createdTimestamp: u
            ? dayjs(u.createdTimestamp).format('DD/MM/YYYY')
            : '',
          riskScore,
          riskLevel,
          amount,
        }
      }
    )

    let text = ''

    text += `
# Enhanced Due Diligence (EDD) and Compliance Review for ${getUserName(user)}

## Client Information

- **Client Name:** ${getUserName(user)}
- **Client Id:** ${user.userId}
- **Client Type:** ${humanizeAuto(user.type)}
- **Review period:** ${dayjs(caseData?.createdTimestamp).format(
      'DD/MM/YYYY'
    )} - ${dayjs(caseData?.createdTimestamp).format('DD/MM/YYYY')}

${
  kycRiskScore?.krsScore
    ? `- **KYC Risk Score:** ${
        kycRiskScore?.krsScore
      } (Risk Level: ${getRiskLevelFromScore(
        riskLevels,
        kycRiskScore?.krsScore
      )})`
    : ''
}

${
  craRiskScore?.drsScore
    ? `- **CRA Risk Score:** ${
        craRiskScore?.drsScore
      } (Risk Level: ${getRiskLevelFromScore(
        riskLevels,
        craRiskScore?.drsScore
      )})`
    : ''
}

## Customer or Client Information

| CIF | Entity Name | Created timestamp | Risk Score | Risk Level | Total Transaction Amount |
|-----|-------------|-------------------|-----------|------------|--------------------------|
${data
  .map(
    (d) =>
      `| ${d.userId} | ${d.userName} | ${d.createdTimestamp} | ${d.riskScore} | ${d.riskLevel} | $${d.amount} |`
  )
  .join('\n')}

`

    if (isBusinessUser(user)) {
      const details = [user, ...(parentUser ? [parentUser] : []), ...childUsers]

      const companyBackground = details.filter(isBusinessUser).map((curr) => {
        const reg = curr.legalEntity?.companyRegistrationDetails
        const tags = reg?.tags || []
        const getTag = (key: string) => tags.find((t) => t.key === key)?.value
        return {
          userId: curr.userId,
          name: getUserName(curr),
          address: getAddress(curr),
          taxIdentifier: reg?.taxIdentifier,
          registrationCountry: reg?.registrationCountry,
          taxResidenceCountry:
            reg?.taxResidenceCountry ?? reg?.registrationCountry,
          legalEntityType: reg?.legalEntityType,
          dateOfRegistration: reg?.dateOfRegistration,
          nacis: getTag('NAICS'),
          sos: getTag('SOS (State)'),
        }
      })

      text += `
## Company Background

| User ID | Entity Name | Address | TIN | Registration Country | Tax Residence Country | Legal Entity Type | Date of Registration | NAICS | SOS (State) |
|---------|-------------|---------|-----|---------------------|-----------------------|-------------------|---------------------|-------|--------------|
${companyBackground
  .map(
    (d) =>
      `| ${d.userId} | ${d.name} | ${d.address} | ${d.taxIdentifier} | ${d.registrationCountry} | ${d.taxResidenceCountry} | ${d.legalEntityType} | ${d.dateOfRegistration} | ${d.nacis} | ${d.sos} |`
  )
  .join('\n')}
`

      const informationRelatedToCompanies = await pMap(
        companyBackground,
        async (d) => {
          const prompt = `
          Please provide a markdown summary for the company "${
            d.name
          }". Include a brief description of the company, its business activities, and any relevant compliance considerations. ${
            isBusinessUser(user) && d.registrationCountry
              ? `The company is registered in ${d.registrationCountry}.`
              : ''
          }
          `

          const response = await this.getPerplexityResponse(prompt)

          return { userId: d.userId, response }
        },
        { concurrency: 3 }
      )

      for (const info of informationRelatedToCompanies) {
        text += `
        ## ${getUserName(user)}
        ${info.response}
        `
      }

      if (isBusinessUser(user)) {
        const beneficialOwners = Object.entries(management).map(
          ([userId, m]) => {
            return {
              userId,
              name: m.name,
              directorNames: m.directors
                .map((d) => getPersonName(d))
                .join(', '),
              shareholderNames: m.shareholders
                .map((s) => getPersonName(s))
                .join(', '),
            }
          }
        )

        text += `
      ## BENEFICIAL OWNER AND CONTROL PERSON

      | User ID | Entity Name | Directors | Shareholders |
      |---------|------ -------|-----------|--------------|
      ${beneficialOwners
        .map(
          (d) =>
            `| ${d.userId} | ${d.name} | ${d.directorNames} | ${d.shareholderNames} |`
        )
        .join('\n')}
        `

        const shareHolders = user.shareHolders?.map((s) => getPersonName(s))
        const directors = user.directors?.map((d) => getPersonName(d))

        const perplexityPrompt = `
      Please provide a detailed management section in markdown format for EDD and compliance review for the company "${getUserName(
        user
      )}". 

      Include:
      - A summary of the management structure.
      - The names and roles of all directors and shareholders.
      - Any relevant compliance considerations or red flags related to management or ownership.
      - Any additional information that may be relevant for enhanced due diligence.

      Shareholders: ${shareHolders?.join(', ') || 'N/A'}
      Directors: ${directors?.join(', ') || 'N/A'}
      `

        const perplexityResponse = await this.getPerplexityResponse(
          perplexityPrompt
        )

        text += `
      ## Management

      ${perplexityResponse}
      `
      }

      const sanctionsSummary = await ask(
        tenantId,
        `
        Please provide a summary of the sanctions related to ${getUserName(
          user
        )}

        You can also search on your knowledge base for more information.

        Data: ${JSON.stringify({ sanctionsInformation })} 

        Write in markdown format in short and concise manner.

        ## Sanctions Summary


        ## OFAC Exposure


        ## Negative News 
        `,
        { provider: 'OPEN_AI', tier: ModelTier.STANDARD, maxTokens: 4096 }
      )

      text += `
      ## Sanctions Summary
      ${sanctionsSummary}
      `

      const riskSummary = await ask(
        tenantId,
        `
        Please provide a summary of the risk related to ${getUserName(user)} 

        Data: ${JSON.stringify({
          krsScore: {
            krsScore: kycRiskScore?.krsScore,
            ...(kycRiskScore?.factorScoreDetails?.length
              ? { factorScoreDetails: kycRiskScore?.factorScoreDetails }
              : {}),
            ...(kycRiskScore?.components?.length
              ? { components: kycRiskScore?.components }
              : {}),
            riskLevel: getRiskLevelFromScore(
              riskLevels,
              kycRiskScore?.krsScore ??
                getRiskScoreFromLevel(riskLevels, DEFAULT_RISK_LEVEL)
            ),
          },
          craRiskScore: {
            drsScore: craRiskScore?.drsScore,
            riskLevel: getRiskLevelFromScore(
              riskLevels,
              craRiskScore?.drsScore ??
                getRiskScoreFromLevel(riskLevels, DEFAULT_RISK_LEVEL)
            ),
            ...(craRiskScore?.factorScoreDetails?.length
              ? { factorScoreDetails: craRiskScore?.factorScoreDetails }
              : {}),
            ...(craRiskScore?.components?.length
              ? { components: craRiskScore?.components }
              : {}),
          },
        })}

        Write in markdown format in short and concise manner.

        ## Risk Summary

        ## Risk Mitigation (in bullet points)

        `,
        { provider: 'OPEN_AI', tier: ModelTier.PROFESSIONAL }
      )

      const auth0Domain = job.parameters.auth0Domain
      const dynamoAccountsRepository = new DynamoAccountsRepository(
        auth0Domain,
        dynamoDb
      )
      const auth0User = await dynamoAccountsRepository.getAccount(
        job.parameters.createdBy
      )
      const auth0UserEmail = auth0User?.email

      text += `${riskSummary}`

      text += `
      ## Remarks

      Prepared By: ${auth0UserEmail ? `${auth0UserEmail}` : ''}
      Date: ${dayjs().format('DD/MM/YYYY')}
      `

      console.log('Generating final draft')

      try {
        const finalDraft = await ask(
          tenantId,
          `
         Structure the following text don't reduce the information remove markers like [1][2][3] and other markers.
         Make good heading and subheadings (in markdown format).
         Make it more readable and easy to understand.
         Don't suggest any next steps.
         Text: ${text}
        `,
          { provider: 'OPEN_AI', tier: ModelTier.STANDARD, maxTokens: 20000 }
        )

        const caseId = job.parameters.caseId
        const s3Client = await getS3Client()
        const caseService = new CaseService(caseRepository, s3Client, {
          documentBucketName: process.env.DOCUMENT_BUCKET || '',
          tmpBucketName: process.env.TMP_BUCKET || '',
        })
        await caseService.saveComment(caseId, {
          body: finalDraft,
        })
      } catch (error) {
        logger.error(error)
      }
    }
  }
}
