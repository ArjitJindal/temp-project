import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'

const WRONG_REGION_TENANTS = {
  'ap-southeast-1': [
    { tenantId: 'YDTX15USTG', tenantName: 'banked_uk', region: 'eu-2' },
    { tenantId: '1PA0RZ0DON', tenantName: 'seis', region: 'us-1' },
    { tenantId: '5CIHDWCU3K', tenantName: 'fingo', region: 'eu-2' },
    {
      tenantId: 'P9400L4R0G',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'QEO03JYKBT', tenantName: 'kevin', region: 'eu-1' },
    { tenantId: '00d5ef91c9', tenantName: 'manigo', region: 'eu-2' },
    {
      tenantId: 'flagright',
      tenantName: 'Flagright (eu-1)',
      region: 'eu-1',
    },
    {
      tenantId: '42ST5H0J6Z',
      tenantName: 'Flagright (eu-2)',
      region: 'eu-2',
    },
    {
      tenantId: 'CRSUPS3XAY',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: '4b75093ae2',
      tenantName: 'helloclever',
      region: 'au-1',
    },
    {
      tenantId: 'EGERX96G57',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '198bb88f6a', tenantName: 'sciopay', region: 'eu-2' },
    { tenantId: '385961b98f', tenantName: 'baraka', region: 'me-1' },
    { tenantId: 'G7ZN1UYR9V', tenantName: 'pesawise', region: 'eu-1' },
    {
      tenantId: '9RXCK6G7LH',
      tenantName: 'Flagright (asia-2)',
      region: 'asia-2',
    },
    {
      tenantId: '0cf1ffbc6d',
      tenantName: 'mistertango',
      region: 'eu-1',
    },
    { tenantId: 'K9NI2TZABA', tenantName: 'tiermoney', region: 'us-1' },
    { tenantId: '1MM', tenantName: '1MM', region: 'eu-1' },
    { tenantId: 'nextpay', tenantName: undefined, region: undefined },
    { tenantId: 'C4IMYTE7A4', tenantName: 'Güeno', region: 'us-1' },
    { tenantId: 'nexpay', tenantName: undefined, region: undefined },
    { tenantId: 'undefined', tenantName: undefined, region: undefined },
    { tenantId: 'FT398YYJMD', tenantName: 'ziina', region: 'asia-2' },
    { tenantId: 'quiqsend', tenantName: undefined, region: undefined },
    { tenantId: 'VXMHDRAZOQ', tenantName: 'banked_au', region: 'au-1' },
    {
      tenantId: '8088853aef',
      tenantName: 'AfortiHolding',
      region: 'eu-1',
    },
    { tenantId: 'QYF2BOXRJI', tenantName: 'capimoney', region: 'eu-2' },
  ],
  'ap-south-1': [
    {
      tenantId: 'P9400L4R0G',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'K9NI2TZABA', tenantName: 'tiermoney', region: 'us-1' },
    {
      tenantId: '761ad9f4be',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: 'flagright',
      tenantName: 'Flagright (eu-1)',
      region: 'eu-1',
    },
    { tenantId: '08ba2ca986', tenantName: 'haikalabs', region: 'eu-1' },
    { tenantId: 'undefined', tenantName: undefined, region: undefined },
    {
      tenantId: 'spicemoney',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: 'P80MYPEJ2Z',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'QYF2BOXRJI', tenantName: 'capimoney', region: 'eu-2' },
    { tenantId: 'G7ZN1UYR9V', tenantName: 'pesawise', region: 'eu-1' },
    {
      tenantId: 'EGERX96G57',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: 'N9OE3YS8QO',
      tenantName: 'Flagright (asia-1)',
      region: 'asia-1',
    },
    { tenantId: '4PKTHPN204', tenantName: 'nexpay', region: 'asia-1' },
    { tenantId: '198bb88f6a', tenantName: 'sciopay', region: 'eu-2' },
    {
      tenantId: 'GDQ5E7M9CE',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '1PA0RZ0DON', tenantName: 'seis', region: 'us-1' },
    {
      tenantId: '3WXSSRH2BC',
      tenantName: 'gueno_tenant_two',
      region: 'us-1',
    },
    { tenantId: '5CIHDWCU3K', tenantName: 'fingo', region: 'eu-2' },
    {
      tenantId: 'CAWJQOEX73',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: '4b75093ae2',
      tenantName: 'helloclever',
      region: 'au-1',
    },
    { tenantId: 'ABRJBYAUW6', tenantName: 'banked_us', region: 'us-1' },
    { tenantId: 'mewt', tenantName: undefined, region: undefined },
    { tenantId: 'QEO03JYKBT', tenantName: 'kevin', region: 'eu-1' },
    {
      tenantId: 'COZWWKQO2B',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'C4IMYTE7A4', tenantName: 'Güeno', region: 'us-1' },
    { tenantId: 'ziina', tenantName: undefined, region: undefined },
    {
      tenantId: 'DNNE9P22WR',
      tenantName: 'Flagright (au-1)',
      region: 'au-1',
    },
    {
      tenantId: 'bukuwarung',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '85J6QJ28BY', tenantName: 'nextpay', region: 'asia-1' },
    { tenantId: '1MM', tenantName: '1MM', region: 'eu-1' },
    { tenantId: '00d5ef91c9', tenantName: 'manigo', region: 'eu-2' },
    { tenantId: 'VXMHDRAZOQ', tenantName: 'banked_au', region: 'au-1' },
    { tenantId: 'YDTX15USTG', tenantName: 'banked_uk', region: 'eu-2' },
    { tenantId: 'E4OY545EB7', tenantName: 'brass', region: 'eu-2' },
    { tenantId: '385961b98f', tenantName: 'baraka', region: 'me-1' },
  ],
  'eu-central-1': [
    { tenantId: '5CIHDWCU3K', tenantName: 'fingo', region: 'eu-2' },
    { tenantId: '198bb88f6a', tenantName: 'sciopay', region: 'eu-2' },
    {
      tenantId: 'DNNE9P22WR',
      tenantName: 'Flagright (au-1)',
      region: 'au-1',
    },
    {
      tenantId: '6IBDJRXD9A',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '1PA0RZ0DON', tenantName: 'seis', region: 'us-1' },
    { tenantId: 'E4OY545EB7', tenantName: 'brass', region: 'eu-2' },
    {
      tenantId: 'UI4OSGWPX5',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'a699692869', tenantName: 'xendit', region: 'asia-1' },
    { tenantId: 'FT398YYJMD', tenantName: 'ziina', region: 'asia-2' },
    {
      tenantId: 'CRSUPS3XAY',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'C4IMYTE7A4', tenantName: 'Güeno', region: 'us-1' },
    {
      tenantId: 'CAWJQOEX73',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: 'GDQ5E7M9CE',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '85J6QJ28BY', tenantName: 'nextpay', region: 'asia-1' },
    {
      tenantId: 'JRQUK42116',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'K9NI2TZABA', tenantName: 'tiermoney', region: 'us-1' },
    {
      tenantId: 'COZWWKQO2B',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: 'P80MYPEJ2Z',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'pesawise', tenantName: undefined, region: undefined },
    { tenantId: 'VXMHDRAZOQ', tenantName: 'banked_au', region: 'au-1' },
    { tenantId: 'YDTX15USTG', tenantName: 'banked_uk', region: 'eu-2' },
    { tenantId: 'boya', tenantName: undefined, region: undefined },
    {
      tenantId: 'JL1VGO30Z2',
      tenantName: 'gueno_prod_eight',
      region: 'us-1',
    },
    {
      tenantId: '42ST5H0J6Z',
      tenantName: 'Flagright (eu-2)',
      region: 'eu-2',
    },
    {
      tenantId: '3WXSSRH2BC',
      tenantName: 'gueno_tenant_two',
      region: 'us-1',
    },
    {
      tenantId: '00PJ95TPKB',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: '4b75093ae2',
      tenantName: 'helloclever',
      region: 'au-1',
    },
    {
      tenantId: 'ORJJDUHC6D',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: 'P9400L4R0G',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'ABRJBYAUW6', tenantName: 'banked_us', region: 'us-1' },
    { tenantId: 'nextpay', tenantName: undefined, region: undefined },
    { tenantId: '649c16439a', tenantName: 'sipelatam', region: 'us-1' },
    { tenantId: 'trove', tenantName: undefined, region: undefined },
    { tenantId: '385961b98f', tenantName: 'baraka', region: 'me-1' },
    {
      tenantId: 'EGERX96G57',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '4PKTHPN204', tenantName: 'nexpay', region: 'asia-1' },
    {
      tenantId: 'N9OE3YS8QO',
      tenantName: 'Flagright (asia-1)',
      region: 'asia-1',
    },
    {
      tenantId: 'VOLX1IP7NN',
      tenantName: 'gueno-tenant-5',
      region: 'us-1',
    },
    { tenantId: 'kevin', tenantName: undefined, region: undefined },
    {
      tenantId: '0NUVY1P4UU',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'cacilian', tenantName: undefined, region: undefined },
    { tenantId: 'US0P7KU8RR', tenantName: 'regtank', region: 'asia-1' },
    { tenantId: '00d5ef91c9', tenantName: 'manigo', region: 'eu-2' },
    { tenantId: 'QYF2BOXRJI', tenantName: 'capimoney', region: 'eu-2' },
    { tenantId: 'undefined', tenantName: undefined, region: undefined },
    {
      tenantId: 'I4N1Y6VCUS',
      tenantName: 'Flagright (us-1)',
      region: 'us-1',
    },
    {
      tenantId: 'S3RI5JAHKZ',
      tenantName: 'gueno-tenant-2',
      region: 'us-1',
    },
  ],
  'eu-west-2': [
    {
      tenantId: 'P9400L4R0G',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'VXMHDRAZOQ', tenantName: 'banked_au', region: 'au-1' },
    {
      tenantId: '9RXCK6G7LH',
      tenantName: 'Flagright (asia-2)',
      region: 'asia-2',
    },
    { tenantId: 'QEO03JYKBT', tenantName: 'kevin', region: 'eu-1' },
    {
      tenantId: 'flagright',
      tenantName: 'Flagright (eu-1)',
      region: 'eu-1',
    },
    { tenantId: 'ABRJBYAUW6', tenantName: 'banked_us', region: 'us-1' },
    {
      tenantId: '34956ce5ec',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '4PKTHPN204', tenantName: 'nexpay', region: 'asia-1' },
    { tenantId: '08ba2ca986', tenantName: 'haikalabs', region: 'eu-1' },
    {
      tenantId: '5985aba67b',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '1PA0RZ0DON', tenantName: 'seis', region: 'us-1' },
    {
      tenantId: 'I4N1Y6VCUS',
      tenantName: 'Flagright (us-1)',
      region: 'us-1',
    },
    { tenantId: 'undefined', tenantName: undefined, region: undefined },
    {
      tenantId: '0cf1ffbc6d',
      tenantName: 'mistertango',
      region: 'eu-1',
    },
    {
      tenantId: 'N9OE3YS8QO',
      tenantName: 'Flagright (asia-1)',
      region: 'asia-1',
    },
    {
      tenantId: 'COZWWKQO2B',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'US0P7KU8RR', tenantName: 'regtank', region: 'asia-1' },
    {
      tenantId: 'EGERX96G57',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '85J6QJ28BY', tenantName: 'nextpay', region: 'asia-1' },
    { tenantId: '1MM', tenantName: '1MM', region: 'eu-1' },
    { tenantId: 'G7ZN1UYR9V', tenantName: 'pesawise', region: 'eu-1' },
    { tenantId: 'K9NI2TZABA', tenantName: 'tiermoney', region: 'us-1' },
    { tenantId: 'a699692869', tenantName: 'xendit', region: 'asia-1' },
    { tenantId: '649c16439a', tenantName: 'sipelatam', region: 'us-1' },
    {
      tenantId: '4b75093ae2',
      tenantName: 'helloclever',
      region: 'au-1',
    },
    {
      tenantId: 'JL1VGO30Z2',
      tenantName: 'gueno_prod_eight',
      region: 'us-1',
    },
    {
      tenantId: '8088853aef',
      tenantName: 'AfortiHolding',
      region: 'eu-1',
    },
    { tenantId: 'C4IMYTE7A4', tenantName: 'Güeno', region: 'us-1' },
    { tenantId: '385961b98f', tenantName: 'baraka', region: 'me-1' },
    { tenantId: 'fingo', tenantName: undefined, region: undefined },
    { tenantId: 'FT398YYJMD', tenantName: 'ziina', region: 'asia-2' },
  ],
  'us-west-2': [
    {
      tenantId: 'P9400L4R0G',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '1MM', tenantName: '1MM', region: 'eu-1' },
    {
      tenantId: 'guenotenantone',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'G7ZN1UYR9V', tenantName: 'pesawise', region: 'eu-1' },
    { tenantId: 'tiermoney', tenantName: undefined, region: undefined },
    {
      tenantId: 'flagright',
      tenantName: 'Flagright (eu-1)',
      region: 'eu-1',
    },
    { tenantId: 'E4OY545EB7', tenantName: 'brass', region: 'eu-2' },
    {
      tenantId: 'BS4BWXIWRL',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'swadesh', tenantName: undefined, region: undefined },
    {
      tenantId: 'EGERX96G57',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '08ba2ca986', tenantName: 'haikalabs', region: 'eu-1' },
    { tenantId: 'VXMHDRAZOQ', tenantName: 'banked_au', region: 'au-1' },
    { tenantId: '85J6QJ28BY', tenantName: 'nextpay', region: 'asia-1' },
    { tenantId: 'gueno', tenantName: undefined, region: undefined },
    {
      tenantId: 'P80MYPEJ2Z',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '385961b98f', tenantName: 'baraka', region: 'me-1' },
    {
      tenantId: 'GDQ5E7M9CE',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'a699692869', tenantName: 'xendit', region: 'asia-1' },
    {
      tenantId: '8088853aef',
      tenantName: 'AfortiHolding',
      region: 'eu-1',
    },
    {
      tenantId: 'CRSUPS3XAY',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'undefined', tenantName: undefined, region: undefined },
    {
      tenantId: 'COZWWKQO2B',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'QYF2BOXRJI', tenantName: 'capimoney', region: 'eu-2' },
    { tenantId: 'QEO03JYKBT', tenantName: 'kevin', region: 'eu-1' },
    { tenantId: '00d5ef91c9', tenantName: 'manigo', region: 'eu-2' },
    {
      tenantId: 'URWR9E3ILE',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: '198bb88f6a', tenantName: 'sciopay', region: 'eu-2' },
    {
      tenantId: 'DYNE4TJQDP',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'YDTX15USTG', tenantName: 'banked_uk', region: 'eu-2' },
    { tenantId: '4PKTHPN204', tenantName: 'nexpay', region: 'asia-1' },
    { tenantId: '5CIHDWCU3K', tenantName: 'fingo', region: 'eu-2' },
    { tenantId: 'seis', tenantName: undefined, region: undefined },
    {
      tenantId: '5985aba67b',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'FT398YYJMD', tenantName: 'ziina', region: 'asia-2' },
    {
      tenantId: '0cf1ffbc6d',
      tenantName: 'mistertango',
      region: 'eu-1',
    },
    {
      tenantId: 'CAWJQOEX73',
      tenantName: undefined,
      region: undefined,
    },
  ],
  'ap-southeast-2': [
    { tenantId: 'YDTX15USTG', tenantName: 'banked_uk', region: 'eu-2' },
    { tenantId: '08ba2ca986', tenantName: 'haikalabs', region: 'eu-1' },
    { tenantId: '5CIHDWCU3K', tenantName: 'fingo', region: 'eu-2' },
    { tenantId: 'E4OY545EB7', tenantName: 'brass', region: 'eu-2' },
    { tenantId: 'a699692869', tenantName: 'xendit', region: 'asia-1' },
    {
      tenantId: 'COZWWKQO2B',
      tenantName: undefined,
      region: undefined,
    },
    {
      tenantId: '42ST5H0J6Z',
      tenantName: 'Flagright (eu-2)',
      region: 'eu-2',
    },
    { tenantId: 'K9NI2TZABA', tenantName: 'tiermoney', region: 'us-1' },
    { tenantId: 'ABRJBYAUW6', tenantName: 'banked_us', region: 'us-1' },
    { tenantId: 'QEO03JYKBT', tenantName: 'kevin', region: 'eu-1' },
    { tenantId: 'QYF2BOXRJI', tenantName: 'capimoney', region: 'eu-2' },
    {
      tenantId: 'flagright',
      tenantName: 'Flagright (eu-1)',
      region: 'eu-1',
    },
    { tenantId: '1MM', tenantName: '1MM', region: 'eu-1' },
    { tenantId: 'FT398YYJMD', tenantName: 'ziina', region: 'asia-2' },
    { tenantId: 'undefined', tenantName: undefined, region: undefined },
  ],
  'me-central-1': [
    {
      tenantId: 'flagright',
      tenantName: 'Flagright (eu-1)',
      region: 'eu-1',
    },
    { tenantId: 'QEO03JYKBT', tenantName: 'kevin', region: 'eu-1' },
    { tenantId: '198bb88f6a', tenantName: 'sciopay', region: 'eu-2' },
    { tenantId: '00d5ef91c9', tenantName: 'manigo', region: 'eu-2' },
    { tenantId: 'G7ZN1UYR9V', tenantName: 'pesawise', region: 'eu-1' },
    {
      tenantId: '42ST5H0J6Z',
      tenantName: 'Flagright (eu-2)',
      region: 'eu-2',
    },
    {
      tenantId: 'N9OE3YS8QO',
      tenantName: 'Flagright (asia-1)',
      region: 'asia-1',
    },
    { tenantId: 'QYF2BOXRJI', tenantName: 'capimoney', region: 'eu-2' },
    {
      tenantId: '6a3915178b',
      tenantName: undefined,
      region: undefined,
    },
    { tenantId: 'undefined', tenantName: undefined, region: undefined },
    {
      tenantId: '4b75093ae2',
      tenantName: 'helloclever',
      region: 'au-1',
    },
    { tenantId: '1PA0RZ0DON', tenantName: 'seis', region: 'us-1' },
    { tenantId: 'YDTX15USTG', tenantName: 'banked_uk', region: 'eu-2' },
  ],
}

export const up = async () => {
  const db = await getMongoDbClientDb()
  const collections = await db.listCollections().toArray()
  const currentRegion = process.env.AWS_REGION as string
  for (const tenant of WRONG_REGION_TENANTS[currentRegion]) {
    const targetCollections = collections.filter((coll) =>
      coll.name.startsWith(tenant.tenantId)
    )
    if (tenant.tenantId !== 'flagright') {
      const txCount = await db
        .collection(TRANSACTIONS_COLLECTION(tenant.tenantId))
        .estimatedDocumentCount()
      if (txCount > 0) {
        throw new Error(
          `Found transactions in ${tenant.tenantId}! Stop dropping collections`
        )
      }
    }
    for (const coll of targetCollections) {
      if (coll.name.startsWith(tenant.tenantId)) {
        await db.dropCollection(coll.name)
        console.log(`Dropped collection ${coll.name} (${tenant.tenantName})`)
      }
    }
  }
}
export const down = async () => {
  // skip
}
