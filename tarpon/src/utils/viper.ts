import {
  Athena,
  GetQueryResultsCommandInput,
  StartQueryExecutionCommandInput,
} from '@aws-sdk/client-athena'
import parseStruct from 'athena-struct-parser'
import { getContext, updateLogMetadata } from '@/core/utils/context'
import { ALL_ATTRIBUTES } from '@/@types/openapi-public-custom/all'

/* Provides a map of lower case attribute values to their cased values, for example:

   originuserid => originUserId

   Athena lower-cases everything, and this map allows us to restore our models back to their cased versions, so we can
   do things like this with typesafety:

   const transactions = executeSql<Transaction>("select * from transactions")
   console.log(transactions[0].originUserId)
*/
const attributeCasingMap = ALL_ATTRIBUTES.reduce((acc, attributeName) => {
  acc.set(attributeName.toLowerCase(), attributeName)
  return acc
}, new Map<string, string>())

// TODO dynamically define these tables
const TABLES = [
  'action_risk_values',
  'dynamic_risk_values',
  'kyc_risk_values',
  'transactions',
  'users',
]
export async function executeSql<T>(
  sql: string,
  namedParameters: any = {}
): Promise<T[]> {
  const athena = new Athena({ apiVersion: '2017-05-18' })

  const partitionQueries = partitionedQueries(
    TABLES,
    getContext()?.tenantId?.toLowerCase()
  )
  const QueryString = `${partitionQueries} ${replacePlaceholders(
    sql,
    namedParameters
  )}`
  const params: StartQueryExecutionCommandInput = {
    QueryString,
    QueryExecutionContext: {
      Database: 'main',
    },
    WorkGroup: 'datalake',
  }

  // The AWS API doesn't have a sync method for executing queries, so we must poll for the result.
  try {
    updateLogMetadata({
      athenaQuery: QueryString,
    })
    const startQueryExecution = await athena.startQueryExecution(params)

    // Wait for the query to complete
    const queryExecutionId = startQueryExecution.QueryExecutionId || ''
    let queryExecutionStatus = 'RUNNING'

    while (
      queryExecutionStatus === 'RUNNING' ||
      queryExecutionStatus === 'QUEUED'
    ) {
      const queryStatus = await athena.getQueryExecution({
        QueryExecutionId: queryExecutionId,
      })
      queryExecutionStatus = queryStatus.QueryExecution?.Status?.State || ''
      if (
        queryExecutionStatus === 'FAILED' ||
        queryExecutionStatus === 'CANCELLED'
      ) {
        throw new Error(
          `Query failed or was cancelled: ${queryStatus.QueryExecution?.Status?.StateChangeReason}`
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 500)) // Wait 500ms before checking again
    }

    // Fetch the results
    const resultParams: GetQueryResultsCommandInput = {
      QueryExecutionId: queryExecutionId,
    }
    const results = await athena.getQueryResults(resultParams)

    // Process the results
    const rows = results.ResultSet?.Rows || []
    const columns = results.ResultSet?.ResultSetMetadata?.ColumnInfo || []

    // slice removes the header row
    return rows.slice(1).map((row) => {
      const obj: any = {}
      row.Data?.forEach((cell, index) => {
        const columnType = columns[index].Type
        const columnName = columns[index].Name
        if (columnName && columnType) {
          obj[columnName] = parseColumn(columnType, cell.VarCharValue)
        }
      })
      return obj
    })
  } catch (error) {
    console.error('An error occurred:', error)
    throw error
  }
}

export function replacePlaceholders(
  sqlQuery: string,
  params: { [key: string]: string | number }
): string {
  // Use a regular expression to find all placeholders in the format :word
  return sqlQuery.replace(/:(\w+)/g, (match, key) => {
    // Check if the key exists in the params object
    if (key in params) {
      // Replace the placeholder with the value from params, adding quotes for SQL string safety
      if (typeof params[key] === 'number') {
        return `${params[key]}`
      }
      return `'${params[key]}'`
    } else {
      // If no matching key is found in params, throw an error or handle as needed
      throw new Error(`Placeholder :${key} not found in parameters.`)
    }
  })
}

// This function will redefine our tables with a partition applied, so that the developer doesn't need to scope the
// queries by tenant.
export function partitionedQueries(tables: string[], tenant?: string) {
  return tables.reduce((queryHeader, table, i) => {
    return `${i === 0 ? 'WITH' : `${queryHeader}, `} ${table} AS (
      SELECT *
      FROM ${table}
    WHERE tenant='${tenant}'
  )`
  }, '')
}

// Helper function to parse columns based on their types
function parseColumn(type: string, value?: string): any {
  if (value === null || value === undefined) {
    return null
  }
  switch (type) {
    case 'integer':
    case 'bigint':
      return parseInt(value, 10)
    case 'double':
    case 'float':
      return parseFloat(value)
    case 'boolean':
      return value.toLowerCase() === 'true'
    case 'struct':
      return parseStruct(value)
    case 'array':
      return JSON.parse(value) // Assuming array is returned as JSON string
    case 'json':
      return JSON.parse(value)
    case 'row':
      try {
        const structValue = value ? parseStruct(value) : null
        return structValue
          ? transformKeys(structValue, attributeCasingMap)
          : null
      } catch (error) {
        console.error('Parsing error for value:', value, error)
        throw error
      }
    case 'date':
      return new Date(value)
    default:
      return value // For string and other types
  }
}

// Recursive function to transform object keys to their cased versions from the given map.
export function transformKeys(obj: any, casingMap: Map<string, string>): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeys(item, casingMap))
  } else if (obj !== null && obj !== undefined && typeof obj === 'object') {
    const newObj: Record<string, any> = {}
    Object.keys(obj).forEach((key) => {
      const newKey = casingMap.get(key.toLowerCase()) || key // Use the new key from map or default to the original key
      newObj[newKey] = transformKeys(obj[key], casingMap) // Recursively apply to nested objects
    })
    return newObj
  }
  return obj
}
