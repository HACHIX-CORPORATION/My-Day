const notificationService = require('./notification.service')
const asyncLocalStorage = require('../../services/als.service')
const logger = require('../../services/logger.service')

function _getUserId() {
    const store = asyncLocalStorage.getStore()
    return store?.loggedinUser?._id
}

async function getSettings(req, res) {
    try {
        const userId = _getUserId()
        const settings = await notificationService.getByUser(userId)
        res.send(settings)
    } catch (err) {
        logger.error('Failed to get notification settings', err)
        res.status(500).send({ err: 'Failed to get notification settings' })
    }
}

async function saveSettings(req, res) {
    try {
        const userId = _getUserId()
        const saved = await notificationService.saveSettings(userId, req.body)
        res.send(saved)
    } catch (err) {
        logger.error('Failed to save notification settings', err)
        res.status(500).send({ err: 'Failed to save notification settings' })
    }
}

async function sendNow(req, res) {
    try {
        const userId = _getUserId()
        const result = await notificationService.sendNow(userId)
        res.send(result)
    } catch (err) {
        logger.error('Failed to send Webex message', err)
        // Return 200 so http.service.js doesn't redirect to home on 500
        res.send({ sent: false, error: err.message || 'Failed to send Webex message' })
    }
}

module.exports = { getSettings, saveSettings, sendNow }
