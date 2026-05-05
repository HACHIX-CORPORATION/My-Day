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

        // Handle Progress start synchronously so webexThreadId is written in the
        // same DB update — prevents the race condition where loadBoards() returns
        // before the separate _saveWebexThreadId write completes.
        if (webexToken && newStatus === 'Progress' && oldStatus !== 'Progress') {
            if (oldStatus === 'Pause' && existingThreadId) {
                try {
                    await webexService.sendThreadReply(existingThreadId, `▶️ Resumed by **${who}**`, realtimeRoom, webexToken)
                    saveTask.webexThreadId = existingThreadId
                } catch {
                    const msg = await webexService.sendMessage(
                        `## 🚀 In Progress\n**${saveTask.title}** — started by **${who}**\nBoard: ${board.title} | Group: ${group.title}`,
                        realtimeRoom,
                        webexToken
                    )
                    saveTask.webexThreadId = msg.id
                }
            } else {
                const msg = await webexService.sendMessage(
                    `## 🚀 In Progress\n**${saveTask.title}** — started by **${who}**\nBoard: ${board.title} | Group: ${group.title}`,
                    realtimeRoom,
                    webexToken
                )
                saveTask.webexThreadId = msg.id
            }
        }

        group.tasks = group.tasks.map(task => (task.id === taskId) ? saveTask : task)
        await update(board)

        // Pause and Done replies don't need a DB write — fire-and-forget is fine
        if (webexToken) {
            _handleStopDoneNotification(oldStatus, newStatus, existingThreadId, who, webexToken, realtimeRoom)
                .catch(err => logger.error('WebEx notification failed', err))
        }

        return board
    } catch (err) {
        logger.error(`cannot update task ${taskId}`, err)
        throw err
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

async function addPauseLabelToBoards() {
    try {
        const collection = await dbService.getCollection('board')
        const boards = await collection.find({}).toArray()
        for (const board of boards) {
            if (board.labels && !board.labels.some(l => l.title === 'Pause')) {
                board.labels.push({ id: 'l108', title: 'Pause', color: '#579bfc' })
                const { _id, ...boardToSave } = board
                await collection.updateOne({ _id }, { $set: boardToSave })
            }
        }
        logger.info('Pause label migration complete')
    } catch (err) {
        logger.error('Pause label migration failed', err)
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
    addPauseLabelToBoards
}
