import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

function parseMarkdownTable(markdown: string): { headers: string[]; rows: string[][] } {
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))

  if (lines.length < 2) return { headers: [], rows: [] }

  const parseRow = (line: string) =>
    line
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.replace(/\\\|/g, '|').trim())

  const headers = parseRow(lines[0])
  const rows = lines
    .slice(2)
    .map(parseRow)
    .filter((row) => row.length > 0)

  return { headers, rows }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.export')
  if (!guard.ok) return guard.response

  const { content } = await req.json() as { content: string }

  if (!content?.trim()) {
    return NextResponse.json({ error: 'No test cases to export' }, { status: 400 })
  }

  const titleMatch = content.match(/^#\s+(.+)/m)
  const sheetName = (titleMatch ? titleMatch[1].trim() : name).slice(0, 31)

  const { headers, rows } = parseMarkdownTable(content)
  if (headers.length === 0) {
    return NextResponse.json({ error: 'Could not parse test cases table' }, { status: 400 })
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'zTestGround'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(sheetName)

  sheet.addRow(headers)
  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
  headerRow.height = 30

  for (const row of rows) {
    const excelRow = sheet.addRow(row)
    excelRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      }
      cell.font = { size: 10 }
    })
    excelRow.height = 60
  }

  const colWidths = [20, 12, 14, 10, 40, 28, 60, 20, 50, 50, 14, 14, 12]
  headers.forEach((_, i) => {
    sheet.getColumn(i + 1).width = colWidths[i] ?? 20
  })

  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}-testcases.xlsx"`,
    },
  })
}
