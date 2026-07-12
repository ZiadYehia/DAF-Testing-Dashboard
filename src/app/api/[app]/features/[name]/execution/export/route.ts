import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import {
  buildExecutionExport,
  renderExecutionMarkdown,
  EXECUTION_STATUS_LABELS,
  EXECUTION_STATUS_FILLS,
} from '@/lib/execution-export'
import { EXECUTION_STATUSES } from '@/lib/execution-types'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.export')
  if (!guard.ok) return guard.response

  const { format, version } = (await req.json().catch(() => ({}))) as { format?: 'md' | 'xlsx'; version?: string }

  const data = await buildExecutionExport(app, name, version)
  if (!data) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
  if (data.rows.length === 0) {
    return NextResponse.json({ error: 'No test cases to export' }, { status: 400 })
  }

  if (format === 'md') {
    const md = renderExecutionMarkdown(data)
    return new NextResponse(md, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}-execution.md"`,
      },
    })
  }

  // ---- Excel ----
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Testing Dashboard'

  const sheet = workbook.addWorksheet(name.slice(0, 31))

  // Summary block
  const titleRow = sheet.addRow([`${data.featureName} — Test Execution Report`])
  titleRow.font = { bold: true, size: 13 }
  sheet.addRow([])

  const sumHeaderRow = sheet.addRow(['Status', 'Count'])
  sumHeaderRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    }
  })

  for (const s of EXECUTION_STATUSES) {
    const r = sheet.addRow([EXECUTION_STATUS_LABELS[s], data.summary[s]])
    const { fill, textWhite } = EXECUTION_STATUS_FILLS[s]
    const labelCell = r.getCell(1)
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    labelCell.font = { size: 10, color: { argb: textWhite ? 'FFFFFFFF' : 'FF000000' } }
  }

  const totalRow = sheet.addRow(['Total', data.total])
  totalRow.font = { bold: true, size: 10 }
  sheet.addRow([])

  // Detail table header
  const headers = [
    'Feature ID', 'TestCase ID', 'Validity', 'Objective',
    'Test Data', 'Expected Results', 'Execution Status', 'Linked Bug',
  ]
  const headerRow = sheet.addRow(headers)
  const headerRowNum = headerRow.number
  headerRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    c.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    }
  })
  headerRow.height = 30

  const STATUS_COL = 7
  const BUG_COL = 8
  for (const row of data.rows) {
    const r = sheet.addRow([
      row.featureId, row.testcaseId, row.validity, row.objective,
      row.testData, row.expectedResults,
      EXECUTION_STATUS_LABELS[row.status], row.linkedBug,
    ])
    r.eachCell({ includeEmpty: true }, (c) => {
      c.alignment = { vertical: 'top', wrapText: true }
      c.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      }
      c.font = { size: 10 }
    })

    const { fill, textWhite } = EXECUTION_STATUS_FILLS[row.status]
    const statusCell = r.getCell(STATUS_COL)
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    statusCell.font = { size: 10, bold: true, color: { argb: textWhite ? 'FFFFFFFF' : 'FF000000' } }
    statusCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

    // Render the linked bug as a clickable Jira hyperlink when the bug is reported.
    if (row.linkedBugUrl) {
      const bugCell = r.getCell(BUG_COL)
      bugCell.value = { text: row.linkedBug, hyperlink: row.linkedBugUrl }
      bugCell.font = { size: 10, color: { argb: 'FF1155CC' }, underline: true }
    }
    r.height = 50
  }

  const colWidths = [20, 14, 10, 45, 40, 45, 18, 16]
  headers.forEach((_, i) => { sheet.getColumn(i + 1).width = colWidths[i] ?? 20 })

  sheet.views = [{ state: 'frozen', ySplit: headerRowNum }]

  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}-execution.xlsx"`,
    },
  })
}
