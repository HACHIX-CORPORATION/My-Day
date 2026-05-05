const express = require('express')
const { getSettings, saveSettings, sendNow } = require('./notification.controller')
const { requireAuth } = require('../../middlewares/requireAuth.middleware')
const router = express.Router()

router.use(requireAuth)

router.get('/settings', getSettings)
router.put('/settings', saveSettings)
router.post('/send', sendNow)

module.exports = router
