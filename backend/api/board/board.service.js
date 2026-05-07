const dbService = require('../../services/db.service')
const logger = require('../../services/logger.service')
const ObjectId = require('mongodb').ObjectId
const webexService = require('../../services/webex.service')
const asyncLocalStorage = require('../../services/als.service')
const userService = require('../user/user.service')

const REALTIME_ROOM = process.env.WEBEX_REALTIME_ROOM_NAME || 'RealTimeReport'

async function query(filterBy) {
    try {
        const criteria = {}
       if(filterBy.title) criteria.title = { $regex: filterBy.title, $options: 'i' }
       if(filterBy.isStarred) criteria.isStarred = filterBy.isStarred
        const collection = await dbService.getCollection('board')
        var boards = await collection.find(criteria).toArray()
        return boards
    } catch (err) {
        logger.error('cannot find boards', err)
        throw err
    }
}

async function getById(boardId) {
    try {
        const collection = await dbService.getCollection('board')
        const board = collection.findOne({ _id: ObjectId(boardId) })
        return board
    } catch (err) {
        logger.error(`while finding board ${boardId}`, err)
        throw err
    }
}

async function remove(boardId) {
    try {
        const collection = await dbService.getCollection('board')
        await collection.deleteOne({ _id: ObjectId(boardId) })
        return boardId
    } catch (err) {
        logger.error(`cannot remove board ${boardId}`, err)
        throw err
    }
}

async function add(board) {
    try {
        const collection = await dbService.getCollection('board')
        await collection.insertOne(board)
        return board
    } catch (err) {
        logger.error('cannot insert board', err)
        throw err
    }
}

async function update(board) {
    try {
        const boardToSave = {...board}
        delete boardToSave._id
        const collection = await dbService.getCollection('board')
        await collection.updateOne({ _id: ObjectId(board._id) }, { $set: boardToSave })
        return board
    } catch (err) {
        logger.error(`cannot update board ${board._id}`, err)
        throw err
    }
}

async function updateTask(boardId, groupId, taskId, saveTask){
    try {
        const board = await getById(boardId)
        const group = board.groups.find(group => group.id === groupId)

        const oldTask = group.tasks.find(t => t.id === taskId)
        const oldStatus = oldTask?.status || ''
        const newStatus = saveTask.status || ''
        const existingThreadId = oldTask?.webexThreadId
        const store = asyncLocalStorage.getStore()
        const who = store?.loggedinUser?.fullname || 'Someone'
        const actorId = store?.loggedinUser?._id
        const webexToken = actorId ? await userService.getWebexToken(actorId) : null

        let realtimeRoom = REALTIME_ROOM
        if (webexToken && actorId) {
            try {
                const settingsCol = await dbService.getCollection('notificationSettings')
                const userSettings = await settingsCol.findOne({ userId: actorId })
                if (userSettings?.webexRealtimeRoomName) realtimeRoom = userSettings.webexRealtimeRoomName
            } catch { /* fall back to env default */ }
        }

        // Auto-track actual time based on status transitions
        if (newStatus === 'Progress' && oldStatus !== 'Progress') {
            saveTask.progressStartedAt = Date.now()
        }
        if (oldStatus === 'Progress' && newStatus !== 'Progress') {
            const elapsed = Math.round((Date.now() - (oldTask.progressStartedAt || Date.now())) / 60000)
            saveTask.actualTime = (saveTask.actualTime || 0) + elapsed
            saveTask.progressStartedAt = null
        }

        group.tasks = group.tasks.map(task => (task.id === taskId) ? { ...saveTask, id: taskId } : task)
        await update(board)

        // All Webex notifications are fire-and-forget so the PUT returns immediately
        if (webexToken) {
            if (newStatus === 'Progress' && oldStatus !== 'Progress') {
                _handleProgressStartNotification(boardId, groupId, taskId, saveTask, board, group, who, realtimeRoom, webexToken, oldStatus, existingThreadId)
                    .catch(err => logger.error('Progress Webex notification failed', err))
            }
            _handleStopDoneNotification(oldStatus, newStatus, existingThreadId, who, webexToken, realtimeRoom)
                .catch(err => logger.error('WebEx notification failed', err))
        }

        return board
    } catch (err) {
        logger.error(`cannot update task ${taskId}`, err)
        throw err
    }
}

async function _handleProgressStartNotification(boardId, groupId, taskId, saveTask, board, group, who, realtimeRoom, webexToken, oldStatus, existingThreadId) {
    let threadId
    if (oldStatus === 'Pause' && existingThreadId) {
        try {
            await webexService.sendThreadReply(existingThreadId, `▶️ Resumed by **${who}**`, realtimeRoom, webexToken)
            threadId = existingThreadId
        } catch {
            const msg = await webexService.sendMessage(
                `## 🚀 In Progress\n**${saveTask.title}** — started by **${who}**\nBoard: ${board.title} | Group: ${group.title}`,
                realtimeRoom, webexToken
            )
            threadId = msg.id
        }
    } else {
        const msg = await webexService.sendMessage(
            `## 🚀 In Progress\n**${saveTask.title}** — started by **${who}**\nBoard: ${board.title} | Group: ${group.title}`,
            realtimeRoom, webexToken
        )
        threadId = msg.id
    }

    if (!threadId) return
    const boardToUpdate = await getById(boardId)
    const g = boardToUpdate.groups.find(gr => gr.id === groupId)
    const t = g?.tasks.find(ta => ta.id === taskId)
    if (t) {
        t.webexThreadId = threadId
        await update(boardToUpdate)
    }
}

async function _handleStopDoneNotification(oldStatus, newStatus, threadId, who, webexToken, realtimeRoom) {
    if (oldStatus === 'Progress' && newStatus !== 'Progress' && newStatus !== 'Done') {
        if (threadId) {
            await webexService.sendThreadReply(threadId, `⏸️ Paused by **${who}**`, realtimeRoom, webexToken)
        }
    }

    if (newStatus === 'Done' && oldStatus !== 'Done') {
        if (threadId) {
            await webexService.sendThreadReply(threadId, `✅ Completed by **${who}**`, realtimeRoom, webexToken)
        }
    }
}

async function updateGroup(boardId, groupId, saveGroup){
    try {
        const board =  await getById(boardId)
        board.groups = board.groups.map(group => (group.id === groupId) ? saveGroup : group)
        await update(board)
        return board
    } catch (err) {
        logger.error(`cannot update task ${groupId}`, err)
        throw err
    }
}

async function normalizeBoardLabels() {
    try {
        const collection = await dbService.getCollection('board')
        const boards = await collection.find({}).toArray()
        for (const board of boards) {
            let dirty = false

            if (board.labels) {
                const STATUS_IDS = new Set(['l101', 'l102', 'l103', 'l108'])
                const PRIORITY_IDS = new Set(['l104', 'l105', 'l106'])
                for (const label of board.labels) {
                    if (label.title.toLowerCase() === 'stack') {
                        label.title = 'Stuck'
                        dirty = true
                    }
                    if (!label.type) {
                        if (STATUS_IDS.has(label.id)) { label.type = 'status'; dirty = true }
                        else if (PRIORITY_IDS.has(label.id)) { label.type = 'priority'; dirty = true }
                    }
                }
                if (!board.labels.some(l => l.title === 'Pause')) {
                    board.labels.push({ id: 'l108', title: 'Pause', color: '#579bfc', type: 'status' })
                    dirty = true
                }
            }

            for (const group of (board.groups || [])) {
                for (const task of (group.tasks || [])) {
                    if (task.status && task.status.toLowerCase() === 'stack') {
                        task.status = 'Stuck'
                        dirty = true
                    }
                }
            }

            if (dirty) {
                const { _id, ...boardToSave } = board
                await collection.updateOne({ _id }, { $set: boardToSave })
            }
        }
        logger.info('Board labels migration complete')
    } catch (err) {
        logger.error('Board labels migration failed', err)
    }
}

async function normalizeTaskIds() {
    function makeId(length = 6) {
        let id = ''
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        for (let i = 0; i < length; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
        return id
    }
    try {
        const collection = await dbService.getCollection('board')
        const boards = await collection.find({}).toArray()
        for (const board of boards) {
            let dirty = false
            for (const group of (board.groups || [])) {
                for (const task of (group.tasks || [])) {
                    if (!task.id) { task.id = makeId(); dirty = true }
                }
            }
            if (dirty) {
                const { _id, ...boardToSave } = board
                await collection.updateOne({ _id }, { $set: boardToSave })
            }
        }
        logger.info('Task IDs migration complete')
    } catch (err) {
        logger.error('Task IDs migration failed', err)
    }
}

async function normalizeTimeCmps() {
    try {
        const collection = await dbService.getCollection('board')
        const boards = await collection.find({}).toArray()
        for (const board of boards) {
            let dirty = false
            if (!board.cmpsOption) board.cmpsOption = []
            if (!board.cmpsOrder) board.cmpsOrder = []
            for (const key of ['estimate-time', 'actual-time']) {
                if (!board.cmpsOption.includes(key)) { board.cmpsOption.push(key); dirty = true }
                if (!board.cmpsOrder.includes(key)) { board.cmpsOrder.push(key); dirty = true }
            }
            if (dirty) {
                const { _id, ...boardToSave } = board
                await collection.updateOne({ _id }, { $set: boardToSave })
            }
        }
        logger.info('Board time columns migration complete')
    } catch (err) {
        logger.error('Board time columns migration failed', err)
    }
}

module.exports = {
    remove,
    query,
    getById,
    add,
    update,
    updateTask,
    updateGroup,
    normalizeBoardLabels,
    normalizeTimeCmps,
    normalizeTaskIds
}
