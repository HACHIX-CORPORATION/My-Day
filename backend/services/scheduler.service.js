const cron = require('node-cron')
const dbService = require('./db.service')
const webexService = require('./webex.service')
const logger = require('./logger.service')
const userService = require('../api/user/user.service')

function _todayStr() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function _currentTime() {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function _isTaskToday(task, todayStr) {
    if (task.isToday) return true
    if (task.dueDate) {
        const due = new Date(task.dueDate)
        const dueLocal = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
        return dueLocal === todayStr
    }
    return false
}

function _formatMessage(tasks, todayStr) {
    const dateLabel = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
    const lines = tasks.map(t => {
        const parts = [`**${t.title}**`]
        if (t.status) parts.push(`Status: ${t.status}`)
        if (t.priority) parts.push(`Priority: ${t.priority}`)
        if (t.boardTitle) parts.push(`Board: ${t.boardTitle}`)
        return `- ${parts.join(' | ')}`
    })
    return `## 🌞 My Tasks – Today (${dateLabel})\n\n${lines.join('\n')}`
}

async function _getTodayTasksForUser(userId, todayStr) {
    const boardCollection = await dbService.getCollection('board')
    const boards = await boardCollection.find({}).toArray()
    logger.info(`[getTodayTasks] boards=${boards.length} userId=${userId} todayStr=${todayStr}`)

    const tasks = []
    boards.forEach(board => {
        board.groups?.forEach(group => {
            group.tasks?.forEach(task => {
                const hasMember = task.memberIds?.includes(userId)
                const notDone = task.status !== 'Done'
                const isToday = _isTaskToday(task, todayStr)
                if (hasMember && notDone && isToday) {
                    tasks.push({ ...task, boardTitle: board.title, groupTitle: group.title })
                } else if (task.isToday || task.memberIds?.length) {
                    logger.info(`[getTodayTasks] skip "${task.title}" hasMember=${hasMember} notDone=${notDone} isToday=${isToday} memberIds=${JSON.stringify(task.memberIds)} task.isToday=${task.isToday}`)
                }
            })
        })
    })
    return tasks
}

async function _runScheduledSend() {
    const todayStr = _todayStr()
    const currentTime = _currentTime()
    const dayOfWeek = new Date().getDay()

    try {
        const collection = await dbService.getCollection('notificationSettings')
        const settings = await collection.find({ sendTime: currentTime }).toArray()

        for (const setting of settings) {
            try {
                if (setting.lastSentDate === todayStr) continue
                if (!setting.workingDays?.includes(dayOfWeek)) continue
                if (setting.restDays?.includes(todayStr)) continue

                const webexToken = await userService.getWebexToken(setting.userId)
                if (!webexToken) {
                    logger.info(`Skipping Webex digest for user ${setting.userId}: no token configured`)
                    continue
                }

                const tasks = await _getTodayTasksForUser(setting.userId, todayStr)
                if (tasks.length === 0) continue

                const roomName = setting.webexRoomName || process.env.WEBEX_ROOM_NAME
                const markdown = _formatMessage(tasks, todayStr)
                await webexService.sendMessage(markdown, roomName, webexToken)
                await collection.updateOne({ _id: setting._id }, { $set: { lastSentDate: todayStr } })
                logger.info(`Webex digest sent for user ${setting.userId}`)
            } catch (err) {
                logger.error(`Failed to send Webex digest for user ${setting.userId}`, err)
            }
        }
    } catch (err) {
        logger.error('Scheduler run failed', err)
    }
}

function start() {
    cron.schedule('* * * * *', _runScheduledSend)
    logger.info('Webex digest scheduler started')
}

module.exports = { start, _getTodayTasksForUser, _formatMessage }
