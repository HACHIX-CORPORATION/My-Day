const axios = require('axios')
const logger = require('./logger.service')

const WEBEX_API = 'https://webexapis.com/v1'

const _roomIdCache = {}

function _headers(token) {
    const tok = token || process.env.WEBEX_TOKEN
    return { Authorization: `Bearer ${tok}` }
}

function _cacheKey(token, roomName) {
    return `${token}:${roomName}`
}

async function _resolveRoomId(roomName, token) {
    const key = _cacheKey(token, roomName)
    if (_roomIdCache[key]) return _roomIdCache[key]
    let res
    try {
        res = await axios.get(`${WEBEX_API}/rooms`, { headers: _headers(token), params: { max: 1000, type: 'group' } })
    } catch (err) {
        const status = err.response?.status
        const msg = err.response?.data?.message || err.message
        throw new Error(`Webex rooms lookup failed (${status}): ${msg}`)
    }
    const room = res.data.items.find(r => r.title === roomName)
    if (!room) {
        const available = res.data.items.map(r => `"${r.title}"`).join(', ')
        logger.error(`Webex: space "${roomName}" not found. Available spaces: ${available}`)
        throw new Error(`Webex space "${roomName}" not found. Available: ${available}`)
    }
    _roomIdCache[key] = room.id
    return _roomIdCache[key]
}

async function sendMessage(markdown, roomName, token) {
    const effectiveRoom = roomName || process.env.WEBEX_ROOM_NAME || 'DailyReport'
    const roomId = await _resolveRoomId(effectiveRoom, token)
    const key = _cacheKey(token, effectiveRoom)
    try {
        const res = await axios.post(
            `${WEBEX_API}/messages`,
            { roomId, markdown },
            { headers: _headers(token) }
        )
        return res.data
    } catch (err) {
        const status = err.response?.status
        const msg = err.response?.data?.message || err.message
        delete _roomIdCache[key]
        throw new Error(`Webex send failed (${status}): ${msg}`)
    }
}

async function sendThreadReply(parentId, markdown, roomName, token) {
    const effectiveRoom = roomName || process.env.WEBEX_ROOM_NAME || 'DailyReport'
    const roomId = await _resolveRoomId(effectiveRoom, token)
    const key = _cacheKey(token, effectiveRoom)
    try {
        await axios.post(
            `${WEBEX_API}/messages`,
            { roomId, parentId, markdown },
            { headers: _headers(token) }
        )
    } catch (err) {
        const status = err.response?.status
        const msg = err.response?.data?.message || err.message
        delete _roomIdCache[key]
        throw new Error(`Webex thread reply failed (${status}): ${msg}`)
    }
}

module.exports = { sendMessage, sendThreadReply }
