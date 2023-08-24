import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { AccountsService, Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { publishAuditLog } from '@/services/audit-log'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
import { logger } from '@/core/logger'

const DATA = [
  {
    originalComment: 'Alert status changed to CLOSED. Reasons: False positive',
    narrative:
      'Alert is closed due to it not being captured by intended rule logic as payments were made from different end-users. Exceptional closure approved by Head of AML Ops 2023.05.03',
    alerts: [
      {
        caseId: 'C-128286',
        alertId: 'A-7467',
      },
      {
        caseId: 'C-128298',
        alertId: 'A-7512',
      },
      {
        caseId: 'C-128300',
        alertId: 'A-7451',
      },
      {
        caseId: 'C-128303',
        alertId: 'A-7420',
      },
      {
        caseId: 'C-128306',
        alertId: 'A-7916',
      },
      {
        caseId: 'C-128316',
        alertId: 'A-7944',
      },
      {
        caseId: 'C-128317',
        alertId: 'A-7434',
      },
      {
        caseId: 'C-128325',
        alertId: 'A-7918',
      },
      {
        caseId: 'C-128329',
        alertId: 'A-7872',
      },
      {
        caseId: 'C-128341',
        alertId: 'A-7528',
      },
      {
        caseId: 'C-128359',
        alertId: 'A-7559',
      },
      {
        caseId: 'C-128363',
        alertId: 'A-7819',
      },
      {
        caseId: 'C-128367',
        alertId: 'A-7714',
      },
      {
        caseId: 'C-128368',
        alertId: 'A-7875',
      },
      {
        caseId: 'C-128369',
        alertId: 'A-7768',
      },
      {
        caseId: 'C-128403',
        alertId: 'A-7954',
      },
      {
        caseId: 'C-128416',
        alertId: 'A-7685',
      },
      {
        caseId: 'C-128443',
        alertId: 'A-7739',
      },
      {
        caseId: 'C-128449',
        alertId: 'A-7910',
      },
      {
        caseId: 'C-128452',
        alertId: 'A-7760',
      },
      {
        caseId: 'C-128453',
        alertId: 'A-7762',
      },
      {
        caseId: 'C-128454',
        alertId: 'A-7786',
      },
      {
        caseId: 'C-128477',
        alertId: 'A-7809',
      },
      {
        caseId: 'C-128479',
        alertId: 'A-7908',
      },
      {
        caseId: 'C-128491',
        alertId: 'A-7841',
      },
      {
        caseId: 'C-128496',
        alertId: 'A-7850',
      },
      {
        caseId: 'C-128507',
        alertId: 'A-7873',
      },
      {
        caseId: 'C-128510',
        alertId: 'A-7880',
      },
      {
        caseId: 'C-128511',
        alertId: 'A-7883',
      },
      {
        caseId: 'C-128524',
        alertId: 'A-7903',
      },
      {
        caseId: 'C-128532',
        alertId: 'A-7921',
      },
      {
        caseId: 'C-128533',
        alertId: 'A-7922',
      },
      {
        caseId: 'C-128536',
        alertId: 'A-7927',
      },
      {
        caseId: 'C-128537',
        alertId: 'A-7929',
      },
      {
        caseId: 'C-128540',
        alertId: 'A-7937',
      },
      {
        caseId: 'C-128541',
        alertId: 'A-7938',
      },
      {
        caseId: 'C-128542',
        alertId: 'A-7941',
      },
      {
        caseId: 'C-128546',
        alertId: 'A-7948',
      },
      {
        caseId: 'C-128552',
        alertId: 'A-7963',
      },
      {
        caseId: 'C-128554',
        alertId: 'A-7969',
      },
      {
        caseId: 'C-128558',
        alertId: 'A-7976',
      },
      {
        caseId: 'C-128563',
        alertId: 'A-7984',
      },
      {
        caseId: 'C-128564',
        alertId: 'A-7986',
      },
      {
        caseId: 'C-128565',
        alertId: 'A-7988',
      },
      {
        caseId: 'C-128568',
        alertId: 'A-7994',
      },
      {
        caseId: 'C-128570',
        alertId: 'A-7997',
      },
      {
        caseId: 'C-128276',
        alertId: 'A-7477',
      },
      {
        caseId: 'C-128295',
        alertId: 'A-7556',
      },
      {
        caseId: 'C-128218',
        alertId: 'A-7708',
      },
      {
        caseId: 'C-128289',
        alertId: 'A-7803',
      },
      {
        caseId: 'C-128517',
        alertId: 'A-7892',
      },
      {
        caseId: 'C-128426',
        alertId: 'A-8033',
      },
      {
        caseId: 'C-128428',
        alertId: 'A-8052',
      },
      {
        caseId: 'C-128447',
        alertId: 'A-8034',
      },
      {
        caseId: 'C-128450',
        alertId: 'A-8059',
      },
      {
        caseId: 'C-128572',
        alertId: 'A-8003',
      },
      {
        caseId: 'C-128573',
        alertId: 'A-8005',
      },
      {
        caseId: 'C-128575',
        alertId: 'A-8011',
      },
      {
        caseId: 'C-128576',
        alertId: 'A-8012',
      },
      {
        caseId: 'C-128577',
        alertId: 'A-8015',
      },
      {
        caseId: 'C-128581',
        alertId: 'A-8027',
      },
      {
        caseId: 'C-128582',
        alertId: 'A-8028',
      },
      {
        caseId: 'C-128583',
        alertId: 'A-8029',
      },
      {
        caseId: 'C-128585',
        alertId: 'A-8037',
      },
      {
        caseId: 'C-128586',
        alertId: 'A-8039',
      },
      {
        caseId: 'C-128588',
        alertId: 'A-8041',
      },
      {
        caseId: 'C-128597',
        alertId: 'A-8057',
      },
      {
        caseId: 'C-128598',
        alertId: 'A-8060',
      },
      {
        caseId: 'C-128599',
        alertId: 'A-8062',
      },
      {
        caseId: 'C-128600',
        alertId: 'A-8063',
      },
      {
        caseId: 'C-128601',
        alertId: 'A-8064',
      },
      {
        caseId: 'C-128602',
        alertId: 'A-8069',
      },
      {
        caseId: 'C-128605',
        alertId: 'A-8077',
      },
      {
        caseId: 'C-128608',
        alertId: 'A-8084',
      },
      {
        caseId: 'C-128609',
        alertId: 'A-8085',
      },
      {
        caseId: 'C-128611',
        alertId: 'A-8090',
      },
      {
        caseId: 'C-128614',
        alertId: 'A-8098',
      },
      {
        caseId: 'C-128615',
        alertId: 'A-8100',
      },
      {
        caseId: 'C-128616',
        alertId: 'A-8104',
      },
      {
        caseId: 'C-128305',
        alertId: 'A-8196',
      },
      {
        caseId: 'C-128361',
        alertId: 'A-8224',
      },
      {
        caseId: 'C-128365',
        alertId: 'A-8134',
      },
      {
        caseId: 'C-128462',
        alertId: 'A-8226',
      },
      {
        caseId: 'C-128612',
        alertId: 'A-8169',
      },
      {
        caseId: 'C-128619',
        alertId: 'A-8108',
      },
      {
        caseId: 'C-128622',
        alertId: 'A-8115',
      },
      {
        caseId: 'C-128624',
        alertId: 'A-8120',
      },
      {
        caseId: 'C-128625',
        alertId: 'A-8121',
      },
      {
        caseId: 'C-128627',
        alertId: 'A-8128',
      },
      {
        caseId: 'C-128629',
        alertId: 'A-8132',
      },
      {
        caseId: 'C-128630',
        alertId: 'A-8136',
      },
      {
        caseId: 'C-128631',
        alertId: 'A-8138',
      },
      {
        caseId: 'C-128632',
        alertId: 'A-8140',
      },
      {
        caseId: 'C-128633',
        alertId: 'A-8144',
      },
      {
        caseId: 'C-128638',
        alertId: 'A-8156',
      },
      {
        caseId: 'C-128639',
        alertId: 'A-8159',
      },
      {
        caseId: 'C-128640',
        alertId: 'A-8160',
      },
      {
        caseId: 'C-128641',
        alertId: 'A-8163',
      },
      {
        caseId: 'C-128642',
        alertId: 'A-8166',
      },
      {
        caseId: 'C-128644',
        alertId: 'A-8170',
      },
      {
        caseId: 'C-128647',
        alertId: 'A-8177',
      },
      {
        caseId: 'C-128649',
        alertId: 'A-8180',
      },
      {
        caseId: 'C-128651',
        alertId: 'A-8182',
      },
      {
        caseId: 'C-128653',
        alertId: 'A-8187',
      },
      {
        caseId: 'C-128654',
        alertId: 'A-8193',
      },
      {
        caseId: 'C-128655',
        alertId: 'A-8195',
      },
      {
        caseId: 'C-128659',
        alertId: 'A-8206',
      },
      {
        caseId: 'C-128661',
        alertId: 'A-8211',
      },
      {
        caseId: 'C-128662',
        alertId: 'A-8213',
      },
      {
        caseId: 'C-128663',
        alertId: 'A-8215',
      },
      {
        caseId: 'C-128664',
        alertId: 'A-8217',
      },
      {
        caseId: 'C-128665',
        alertId: 'A-8219',
      },
      {
        caseId: 'C-128667',
        alertId: 'A-8223',
      },
      {
        caseId: 'C-128668',
        alertId: 'A-8227',
      },
      {
        caseId: 'C-128671',
        alertId: 'A-8234',
      },
      {
        caseId: 'C-128672',
        alertId: 'A-8237',
      },
      {
        caseId: 'C-128674',
        alertId: 'A-8240',
      },
      {
        caseId: 'C-128675',
        alertId: 'A-8241',
      },
      {
        caseId: 'C-128676',
        alertId: 'A-8243',
      },
      {
        caseId: 'C-128677',
        alertId: 'A-8247',
      },
      {
        caseId: 'C-128679',
        alertId: 'A-8251',
      },
      {
        caseId: 'C-128681',
        alertId: 'A-8255',
      },
      {
        caseId: 'C-128682',
        alertId: 'A-8256',
      },
    ],
  },
  {
    originalComment: 'Alert status changed to CLOSED. Reasons: False positive',
    narrative:
      'Alert is closed due to it not being captured by intended rule logic, no increase was identified. Exceptional closure approved by Head of AML Ops 2023.05.19',
    alerts: [
      {
        caseId: 'C-128251',
        alertId: 'A-7541',
      },
      {
        caseId: 'C-128253',
        alertId: 'A-7799',
      },
      {
        caseId: 'C-128254',
        alertId: 'A-7606',
      },
      {
        caseId: 'C-128298',
        alertId: 'A-7679',
      },
      {
        caseId: 'C-128299',
        alertId: 'A-7524',
      },
      {
        caseId: 'C-128306',
        alertId: 'A-7793',
      },
      {
        caseId: 'C-128316',
        alertId: 'A-7563',
      },
      {
        caseId: 'C-128318',
        alertId: 'A-7515',
      },
      {
        caseId: 'C-128319',
        alertId: 'A-7627',
      },
      {
        caseId: 'C-128339',
        alertId: 'A-7508',
      },
      {
        caseId: 'C-128341',
        alertId: 'A-7526',
      },
      {
        caseId: 'C-128370',
        alertId: 'A-7582',
      },
      {
        caseId: 'C-128373',
        alertId: 'A-7588',
      },
      {
        caseId: 'C-128374',
        alertId: 'A-7589',
      },
      {
        caseId: 'C-128403',
        alertId: 'A-7683',
      },
      {
        caseId: 'C-128410',
        alertId: 'A-7784',
      },
      {
        caseId: 'C-128413',
        alertId: 'A-7672',
      },
      {
        caseId: 'C-128416',
        alertId: 'A-7677',
      },
      {
        caseId: 'C-128428',
        alertId: 'A-7703',
      },
      {
        caseId: 'C-128440',
        alertId: 'A-7735',
      },
      {
        caseId: 'C-128444',
        alertId: 'A-7742',
      },
      {
        caseId: 'C-128447',
        alertId: 'A-7753',
      },
      {
        caseId: 'C-128471',
        alertId: 'A-7797',
      },
      {
        caseId: 'C-128473',
        alertId: 'A-7800',
      },
      {
        caseId: 'C-128481',
        alertId: 'A-7818',
      },
      {
        caseId: 'C-128303',
        alertId: 'A-7428',
      },
      {
        caseId: 'C-128320',
        alertId: 'A-7440',
      },
      {
        caseId: 'C-128491',
        alertId: 'A-7843',
      },
      {
        caseId: 'C-128511',
        alertId: 'A-7884',
      },
      {
        caseId: 'C-128517',
        alertId: 'A-7893',
      },
      {
        caseId: 'C-128533',
        alertId: 'A-7924',
      },
      {
        caseId: 'C-128537',
        alertId: 'A-7930',
      },
      {
        caseId: 'C-128552',
        alertId: 'A-7964',
      },
      {
        caseId: 'C-128554',
        alertId: 'A-7968',
      },
      {
        caseId: 'C-128565',
        alertId: 'A-7989',
      },
      {
        caseId: 'C-128572',
        alertId: 'A-8004',
      },
      {
        caseId: 'C-128575',
        alertId: 'A-8014',
      },
      {
        caseId: 'C-128582',
        alertId: 'A-8030',
      },
      {
        caseId: 'C-128597',
        alertId: 'A-8058',
      },
      {
        caseId: 'C-128605',
        alertId: 'A-8078',
      },
      {
        caseId: 'C-128611',
        alertId: 'A-8089',
      },
      {
        caseId: 'C-128615',
        alertId: 'A-8101',
      },
      {
        caseId: 'C-128609',
        alertId: 'A-8137',
      },
      {
        caseId: 'C-128629',
        alertId: 'A-8133',
      },
      {
        caseId: 'C-128633',
        alertId: 'A-8145',
      },
      {
        caseId: 'C-128638',
        alertId: 'A-8157',
      },
      {
        caseId: 'C-128642',
        alertId: 'A-8165',
      },
      {
        caseId: 'C-128644',
        alertId: 'A-8171',
      },
      {
        caseId: 'C-128651',
        alertId: 'A-8183',
      },
      {
        caseId: 'C-128662',
        alertId: 'A-8214',
      },
      {
        caseId: 'C-128664',
        alertId: 'A-8218',
      },
      {
        caseId: 'C-128668',
        alertId: 'A-8228',
      },
      {
        caseId: 'C-128676',
        alertId: 'A-8244',
      },
      {
        caseId: 'C-128683',
        alertId: 'A-8261',
      },
      {
        caseId: 'C-128684',
        alertId: 'A-8265',
      },
      {
        caseId: 'C-128691',
        alertId: 'A-8283',
      },
      {
        caseId: 'C-128696',
        alertId: 'A-8289',
      },
      {
        caseId: 'C-128710',
        alertId: 'A-8323',
      },
      {
        caseId: 'C-128712',
        alertId: 'A-8330',
      },
      {
        caseId: 'C-128725',
        alertId: 'A-8373',
      },
      {
        caseId: 'C-128734',
        alertId: 'A-8382',
      },
      {
        caseId: 'C-128737',
        alertId: 'A-8430',
      },
      {
        caseId: 'C-128767',
        alertId: 'A-8451',
      },
      {
        caseId: 'C-128226',
        alertId: 'A-7494',
      },
      {
        caseId: 'C-128299',
        alertId: 'A-7522',
      },
      {
        caseId: 'C-128300',
        alertId: 'A-7449',
      },
      {
        caseId: 'C-128317',
        alertId: 'A-7433',
      },
      {
        caseId: 'C-128318',
        alertId: 'A-7514',
      },
      {
        caseId: 'C-128341',
        alertId: 'A-7525',
      },
      {
        caseId: 'C-128345',
        alertId: 'A-7535',
      },
      {
        caseId: 'C-128350',
        alertId: 'A-7544',
      },
      {
        caseId: 'C-128359',
        alertId: 'A-7564',
      },
      {
        caseId: 'C-128367',
        alertId: 'A-7575',
      },
      {
        caseId: 'C-128369',
        alertId: 'A-7580',
      },
      {
        caseId: 'C-128440',
        alertId: 'A-8452',
      },
      {
        caseId: 'C-128716',
        alertId: 'A-8335',
      },
      {
        caseId: 'C-128718',
        alertId: 'A-8343',
      },
      {
        caseId: 'C-128722',
        alertId: 'A-8350',
      },
      {
        caseId: 'C-128729',
        alertId: 'A-8368',
      },
      {
        caseId: 'C-128730',
        alertId: 'A-8371',
      },
      {
        caseId: 'C-128733',
        alertId: 'A-8380',
      },
      {
        caseId: 'C-128744',
        alertId: 'A-8406',
      },
      {
        caseId: 'C-128745',
        alertId: 'A-8411',
      },
      {
        caseId: 'C-128759',
        alertId: 'A-8437',
      },
      {
        caseId: 'C-128765',
        alertId: 'A-8445',
      },
      {
        caseId: 'C-128768',
        alertId: 'A-8454',
      },
      {
        caseId: 'C-128774',
        alertId: 'A-8461',
      },
    ],
  },
]

async function migrateTenant(tenant: Tenant) {
  // Only migrate Kevin prod
  if (tenant.id !== 'QEO03JYKBT') {
    return
  }

  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService(
    { auth0Domain: 'flagright.eu.auth0.com' },
    { mongoDb }
  )
  const accounts = await accountsService.getTenantAccounts(tenant)

  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))

  for (const item of DATA) {
    for (const entry of item.alerts) {
      const c = await casesCollection.findOne({ caseId: entry.caseId })
      if (!c) {
        throw new Error(`Cannot find case ${entry.caseId}`)
      }
      const targetAlert = (c.alerts ?? []).find(
        (alert) => alert.alertId === entry.alertId
      )
      const comment = targetAlert?.comments?.find(
        (comment) => comment.body === item.originalComment
      )
      if (comment) {
        const newBody = `${comment.body}\n${item.narrative}`

        // Update comment
        await casesCollection.updateOne(
          { caseId: entry.caseId },
          {
            $set: {
              'alerts.$[alert].comments.$[comment].body': newBody,
            },
          },
          {
            arrayFilters: [
              { 'alert.alertId': entry.alertId },
              { 'comment.id': comment.id },
            ],
          }
        )

        // Backfill audit log
        const update: AlertStatusUpdateRequest = {
          reason: targetAlert?.lastStatusChange?.reason ?? [],
          otherReason: targetAlert?.lastStatusChange?.otherReason,
          alertStatus: targetAlert?.lastStatusChange?.caseStatus ?? 'CLOSED',
          comment: newBody,
        }
        await publishAuditLog(tenant.id, {
          type: 'ALERT',
          action: 'UPDATE',
          timestamp: comment.createdAt,
          entityId: entry.alertId,
          newImage: update,
          user: accounts.find((account) => account.id === comment.userId),
        })

        logger.info(`Updated alert ${entry.alertId} (case: ${entry.caseId})`)
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
