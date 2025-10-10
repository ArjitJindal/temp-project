import { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { neverReturn } from '@/utils/lang'

export type ReportResultParagraph = {
  kind: 'PARAGRAPH'
  text: string
}

export type ReportResultGrid = {
  kind: 'GRID'
  rows: Array<ReportResultItem[]>
}

export type ReportResultFormTextField = {
  kind: 'FORM_TEXT_FIELD'
  value: string
}

export type ReportResultHeading = {
  kind: 'HEADING'
  level?: number
  text: string
}

export type ReportResultItem =
  | ReportResultParagraph
  | ReportResultHeading
  | ReportResultGrid
  | ReportResultFormTextField

export type ReportDocument = ReportResultItem[]

export function p(text: string): ReportResultParagraph {
  return {
    kind: 'PARAGRAPH',
    text,
  }
}

export function grid(rows: ReportResultItem[][]): ReportResultGrid {
  return {
    kind: 'GRID',
    rows,
  }
}

export function h(level: number, text: string): ReportResultHeading {
  return {
    kind: 'HEADING',
    level,
    text,
  }
}

export function textField(value: string): ReportResultFormTextField {
  return {
    kind: 'FORM_TEXT_FIELD',
    value,
  }
}

export async function generatePdf(
  document: ReportDocument
): Promise<NodeJS.ReadableStream> {
  const pdfMake = await import('pdfmake')
  const PdfPrinter = pdfMake.default

  const printer = new PdfPrinter({
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  })

  function convertItem(item: ReportResultItem): Content {
    if (item.kind === 'HEADING') {
      const level = item.level ?? 1
      return {
        table: {
          headerRows: 0,
          widths: ['*'],
          body: [[{ text: item.text, style: `header${level}` }]],
        },
        layout: 'noBorders',
        margin: [0, 15 - (level - 1) * 2],
      }
    } else if (item.kind === 'PARAGRAPH') {
      return { text: item.text, margin: [0, 8] }
    } else if (item.kind === 'GRID') {
      const maxColumns = item.rows.reduce(
        (acc, row) => Math.max(acc, row.length),
        0
      )
      return {
        table: {
          headerRows: 0,
          widths: [...new Array(maxColumns)].map(() => '*'),
          body: item.rows.map((row) => row.map(convertItem)),
        },
        layout: 'noBorders',
        margin: [0, 15],
      }
    } else if (item.kind === 'FORM_TEXT_FIELD') {
      const tableCell: TableCell = {
        text: item.value || ' ',
        style: `textField`,
      }
      return {
        table: {
          headerRows: 0,
          widths: ['*'],
          body: [[tableCell]],
        },
        margin: [0, 0],
      }
    } else {
      return neverReturn(item, {
        text: `Unknown item: ${JSON.stringify(item)}`,
      })
    }
  }

  const docDefinition: TDocumentDefinitions = {
    content: document.map(convertItem),
    styles: {
      header1: {
        fontSize: 18,
        bold: true,
        alignment: 'center',
        color: 'white',
        fillColor: '#002060',
      },
      header2: {
        fontSize: 16,
        alignment: 'center',
        color: 'white',
        fillColor: '#375f91',
      },
      header3: {
        fontSize: 14,
        color: 'white',
        fillColor: '#375f91',
      },
      textField: {
        fillColor: '#ffeead',
      },
    },
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 12,
    },
  }

  const options = {
    tableLayouts: {},
  }

  const pdfDoc = printer.createPdfKitDocument(docDefinition, options)
  pdfDoc.initForm()
  pdfDoc.end()
  return pdfDoc
}
