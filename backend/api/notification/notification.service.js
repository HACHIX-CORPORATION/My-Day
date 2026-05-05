const dbService = require('../../services/db.service')
const webexService = require('../../services/webex.service')
const userService = require('../user/user.service')
const { _getTodayTasksForUser, _formatMessage } = require('../../services/scheduler.service')
const logger = require('../../services/logger.service')

const DEFAULT_ROOM = process.env.WEBEX_ROOM_NAME || 'DailyReport'
const DEFAULT_REALTIME_ROOM = process.env.WEBEX_REALTIME_ROOM_NAME || 'RealTimeReport'

async function getByUser(userId) {
    try {
        const collection = await dbService.getCollection('notificationSettings')
        const settings = await collection.findOne({ userId })
        if (!settings) return {
            userId,
            workingDays: [1, 2, 3, 4, 5],
            restDays: [],
            sendTime: '08:00',
            webexRoomName: DEFAULT_ROOM,
            webexRealtimeRoomName: DEFAULT_REALTIME_ROOM,
        }
        return {
            ...settings,
            webexRoomName: settings.webexRoomName || DEFAULT_ROOM,
            webexRealtimeRoomName: settings.webexRealtimeRoomName || DEFAULT_REALTIME_ROOM,
        }
    } catch (err) {
        logger.error(`Failed to get notification settings for user ${userId}`, err)
        throw err
    }
}

async function saveSettings(userId, data) {
    try {
        const collection = await dbService.getCollection('notificationSettings')
        const update = {
            userId,
            sendTime: data.sendTime || '08:00',
            workingDays: data.workingDays ?? [1, 2, 3, 4, 5],
            restDays: data.restDays || [],
            webexRoomName: data.webexRoomName || DEFAULT_ROOM,
            webexRealtimeRoomName: data.webexRealtimeRoomName || DEFAULT_REALTIME_ROOM,
        }
        await collection.updateOne({ userId }, { $set: update }, { upsert: true })
        return update
    } catch (err) {
        logger.error(`Failed to save notification settings for user ${userId}`, err)
        throw err
    }
}

async function sendNow(userId) {
    try {
        logger.info(`[sendNow] userId=${userId}`)
        const webexToken = await userService.getWebexToken(userId)
        if (!webexToken) return { sent: false, reason: 'Webex token not configured' }

        const settings = await getByUser(userId)
        const roomName = settings.webexRoomName || process.env.WEBEX_ROOM_NAME

        const d = new Date()
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        logger.info(`[sendNow] todayStr=${todayStr}`)
        const tasks = await _getTodayTasksForUser(userId, todayStr)
        logger.info(`[sendNow] tasks found=${tasks.length}`)
        if (tasks.length === 0) {
            return { sent: false, reason: 'No tasks in Today group' }
        }
        const markdown = _formatMessage(tasks, todayStr)
        await webexService.sendMessage(markdown, roomName, webexToken)
        return { sent: true, count: tasks.length }
    } catch (err) {
        logger.error(`Failed to send Webex message now for user ${userId}`, err)
        throw err
    }
}

module.exports = { getByUser, saveSettings, sendNow }
