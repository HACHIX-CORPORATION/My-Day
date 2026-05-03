import * as XLSX from 'xlsx'
import { boardService } from './board.service'
import { utilService } from './util.service'

const STATUS_MAP = {
    closed: 'Done',
    doing: 'Working on it',
    open: '',
    PAUSED: 'Stuck',
    stuck: 'Stuck',
    done: 'Done',
}

export const importService = {
    parseMondayXLSX,
    buildBoardFromImport,
}

function parseMondayXLSX(fileBuffer) {
    const wb = XLSX.read(fileBuffer, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    const boardTitle = String(rows[0]?.[0] || '').trim() || 'Imported Board'
    const groups = []
    let currentGroup = null
    let inTasks = false

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const firstCol = String(row[0] ?? '').trim()

        if (!firstCol) continue
        if (firstCol === 'Name') {
            inTasks = true
            continue
        }

        const isGroupHeader = row.slice(1).every(v => !v || String(v).trim() === '')
        if (isGroupHeader) {
            currentGroup = { title: firstCol, tasks: [] }
            groups.push(currentGroup)
            inTasks = false
            continue
        }

        if (currentGroup && inTasks) {
            currentGroup.tasks.push(_buildTask(row))
        }
    }

    return { boardTitle, groups }
}

function buildBoardFromImport(parsed, loggedUser) {
    const board = boardService.getEmptyBoard()
    board.title = parsed.boardTitle
    if (loggedUser) board.createdBy = loggedUser
    board.groups = parsed.groups.map(g => ({
        ...boardService.getEmptyGroup(),
        id: utilService.makeId(),
        title: g.title,
        tasks: g.tasks,
    }))
    return board
}

function _buildTask(row) {
    const rawDate = row[5]
    return {
        ...boardService.getEmptyTask(),
        id: utilService.makeId(),
        title: String(row[0]),
        status: STATUS_MAP[row[3]] ?? String(row[3] || ''),
        dueDate: rawDate instanceof Date ? rawDate.getTime() : '',
    }
}
