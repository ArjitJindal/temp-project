import { ReadStream } from 'fs'
import path from 'path'
import * as XLSX from 'xlsx-js-style'
import fs from 'fs-extra'

export const SECTION_HEADER_STYLE = {
  font: { color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1169f9' } },
}

export const SECTION_HEADER_STYLE_2 = {
  font: { color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1169f9' } },
}

export const TABLE_HEADER_STYLE = {
  font: { color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1169f9' } },
}

export type Row = (string | number | boolean | undefined | null)[]

export interface Section {
  section: string
  children: Item[]
}

export interface Table {
  header: string[]
  columnHeader?: string[]
  rows: Row[]
}

export type Item = Row | Section | Table

export interface Sheet {
  sheet: string
  children: Item[]
}

export type Report = Sheet[]

export async function convert(report: Report): Promise<ReadStream> {
  // Create a new workbook
  const wb = XLSX.utils.book_new()

  function countMaxColumns(items: Item[], level = 0): number {
    function countItem(item: Item): number {
      if (Array.isArray(item)) {
        return item.length
      }
      if ('header' in item) {
        return Math.max(
          item.header.length + (item.columnHeader?.length ? 1 : 0),
          countMaxColumns(item.rows)
        )
      }
      return countMaxColumns(item.children, level + 1)
    }
    return items.reduce((acc, item) => {
      return Math.max(acc, countItem(item) + 1)
    }, 0)
  }

  function emptyCells(count: number) {
    return [...new Array(count)].map(() => '')
  }

  // Create worksheet with rows; Add worksheet to workbook
  for (const sheet of report) {
    const maxColumns = Math.max(10, countMaxColumns(sheet.children))

    const renderItem = (item: Item, level = 0) => {
      if (Array.isArray(item)) {
        return [[...emptyCells(level), ...item]]
      }
      if ('header' in item) {
        const { header, rows, columnHeader = [] } = item
        const result: unknown[] = []
        if (header.length > 0) {
          result.push([
            ...emptyCells(level),
            ...(columnHeader.length > 0
              ? [{ v: '', s: TABLE_HEADER_STYLE }]
              : []),
            ...header.map((v) => ({ v, s: TABLE_HEADER_STYLE })),
          ])
        }
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          result.push([
            ...emptyCells(level),
            ...(columnHeader.length > 0
              ? [{ v: columnHeader[i], s: TABLE_HEADER_STYLE }]
              : []),
            ...row,
          ])
        }

        return result
      }

      return renderSection(item, level)
    }

    const renderSection = (section: Section, level = 0) => [
      [
        ...emptyCells(level),
        ...[...new Array(maxColumns - level)].map((_, i) => {
          const style =
            level < 2 ? SECTION_HEADER_STYLE : SECTION_HEADER_STYLE_2
          return i === 0
            ? {
                v: section.section,
                s: style,
              }
            : {
                v: '',
                s: style,
              }
        }),
      ],
      ...section.children.flatMap((item: Item) => renderItem(item, level + 1)),
    ]

    const data = sheet.children.flatMap((item) => renderItem(item))

    const ws = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheet)
  }

  // Write Excel file to temporal dir
  const outputPath = path.join(
    '/tmp',
    'case-reports',
    `case-report-${Date.now()}.xlsx`
  )
  await fs.ensureDir(path.dirname(outputPath))
  XLSX.writeFile(wb, outputPath)

  // Turn into string
  const readStream = fs.createReadStream(outputPath)
  return readStream
}
