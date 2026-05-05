import { httpService } from './http.service.js'
import { userService } from './user.service.js'
import { utilService } from './util.service.js'

const BASE_URL = 'board/'

export const boardService = {
    query,
    getById,
    getFilteredBoard,
    getMemberTasksFromBoards,
    save,
    remove,
    getDefaultFilterBoard,
    getDefaultFilterBoards,
    getFilterFromSearchParams,
    getEmptyGroup,
    getEmptyTask,
    getEmptyComment,
    getEmptyActivity,
    getEmptyBoard,
    updateTask,
    updateGroup
}

function query(filter = getDefaultFilterBoards()) {
    const queryParams = `?title=${filter.title}&isStarred=${filter.isStarred}`
    return httpService.get(BASE_URL + queryParams)
}

function getMemberTasksFromBoards(boards, memberId) {
    const tasks = []
    boards.forEach(board => {
        board.groups?.forEach(group => {
            group.tasks?.forEach(task => {
                if (task.memberIds?.includes(memberId)) {
                    tasks.push({
                        ...task,
                        boardId: board._id,
                        boardTitle: board.title,
                        boardLabels: board.labels,
                        groupId: group.id,
                        groupTitle: group.title,
                        groupColor: group.color,
                    })
                }
            })
        })
    })
    return tasks
}

function getFilteredBoard(board, filterBy = getDefaultFilterBoard()) {
    const filteredBoard = {...board}
    if (filterBy.title) {
        const regex = new RegExp(filterBy.title, 'i')
        const groups = filteredBoard.groups.filter(group => regex.test(group.title))
        groups.forEach(group => {
            group.tasks = group.tasks.filter(task => regex.test(task.title))
        })
    }
    if (filterBy.memberId) {
        const groups = filteredBoard.groups
        groups.forEach(group => {
            group.tasks = group.tasks.filter(task => task.memberIds.includes(filterBy.memberId))
        })
    }
    return filteredBoard
}

function getById(boardId) {
    return httpService.get(BASE_URL + boardId)
}

function remove(boardId) {
    return httpService.delete(BASE_URL + boardId)
}

function save(board) {
    if (board._id) return httpService.put(BASE_URL + board._id, board)
    return httpService.post(BASE_URL, board)
}

function updateTask(boardId, groupId, task) {
    return httpService.put(`${BASE_URL}${boardId}/${groupId}/${task.id}`, task)
}

function updateGroup(boardId, group) {
    return httpService.put(`${BASE_URL}${boardId}/${group.id}`, group)
}

function getDefaultFilterBoards() {
    return {
        title: '',
        isStarred: false
    }
}

function getDefaultFilterBoard() {
    return {
            title: '',
            memberId: '' 
        }
}

function getFilterFromSearchParams(searchParams) {
    const emptyFilter = getDefaultFilterBoard()
    const filterBy = {}
    for (const field in emptyFilter) {
        filterBy[field] = searchParams.get(field) || ''
    }
    return filterBy
}

function getEmptyGroup() {
    return {
        "title": 'New Group',
        "archivedAt": Date.now(),
        "tasks": [],
        "color": '#ffcb00',
    }
}

function getEmptyTask() {
    return {
        "title": "",
        "status": "",
        "priority": "",
        "memberIds": [],
        "dueDate": '',
        "comments": [],
        "updatedBy":{
            "imgUrl":"",
        },
        "file": "",
        "estimateTime": 0,
        "actualTime": 0,
        "progressStartedAt": null,
    }
}

function getEmptyComment() {
    return {
        "archivedAt": Date.now(),
        "byMember": {
            "_id": null,
            "fullname": "Guest",
            "imgUrl": "https://res.cloudinary.com/du63kkxhl/image/upload/v1675013009/guest_f8d60j.png"
        }, "txt": "",
        "style": {
            "textDecoration": "none",
            "fontWeight": "normal",
            "fontStyle": "normal",
            "textAlign": "Left"
        }
    }
}

function getEmptyActivity() {
    return {
        "action": "status",
        "createdAt": Date.now(),
        "byMember": userService.getLoggedinUser() || {
            "_id": null,
            "fullname": "Guest",
            "imgUrl": "https://res.cloudinary.com/du63kkxhl/image/upload/v1675013009/guest_f8d60j.png"
        },
        "task": {
            "id": "c101",
            "title": "Replace Logo"
        },
        "from": {}, 
        "to": {}
    }
}

function getEmptyBoard() {
    return {
        "title": 'New Board',
        "archivedAt": Date.now(),
        "isStarred": false,
        "createdBy":{
            "fullname":"Ofer Gavrilov",
            "imgUrl":"https://res.cloudinary.com/du63kkxhl/image/upload/v1674069496/me_dpbzfs.jpg",
            "_id": utilService.makeId()
        },
        "labels": [
            { "id": "l101", "title": "Done",     "color": "#00c875", "type": "status" },
            { "id": "l102", "title": "Progress", "color": "#fdab3d", "type": "status" },
            { "id": "l103", "title": "Stuck",    "color": "#e2445c", "type": "status" },
            { "id": "l108", "title": "Pause",    "color": "#579bfc", "type": "status" },
            { "id": "l104", "title": "Low",      "color": "#ffcb00", "type": "priority" },
            { "id": "l105", "title": "Medium",   "color": "#a25ddc", "type": "priority" },
            { "id": "l106", "title": "High",     "color": "#e2445c", "type": "priority" },
            { "id": "l107", "title": "",         "color": "#c4c4c4" },
        ],
        "members": [
            {
                "_id": "m101",
                "fullname": "Tal Tarablus",
                "imgUrl": "https://res.cloudinary.com/du63kkxhl/image/upload/v1673788222/cld-sample.jpg"
            },
            {
                "_id": "m102",
                "fullname": "Idan David",
                "imgUrl": "https://res.cloudinary.com/du63kkxhl/image/upload/v1673820094/%D7%A2%D7%99%D7%93%D7%9F_jranbo.jpg"
            },
            {
                "_id": "m103",
                "fullname": "Ofek Tarablus",
                "imgUrl": "https://res.cloudinary.com/du63kkxhl/image/upload/v1674069458/image_exxnux.png"
            },
            {
                "_id": "m104",
                "fullname": "Ofer Tarablus",
                "imgUrl": "https://res.cloudinary.com/du63kkxhl/image/upload/v1674069496/me_dpbzfs.jpg"
            }
        ],
        "groups": [],
        "activities": [],
        "cmpsOrder": ["status-picker", "member-picker", "date-picker", 'priority-picker', 'updated-picker', 'estimate-time', 'actual-time'],
        "description": "",
        "cmpsOption": ["status-picker", "member-picker", "date-picker", 'priority-picker', 'number-picker', 'file-picker', 'updated-picker', 'estimate-time', 'actual-time']
    }
}


