import { useEffect, useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import DatePicker from 'react-datepicker'

import { loadBoards } from '../store/board.actions'
import { loadUsers } from '../store/user.actions'
import { boardService } from '../services/board.service'
import { notificationService } from '../services/notification.service'
import { userService } from '../services/user.service'

import { MainSidebar } from '../cmps/sidebar/main-sidebar'
import { WorkspaceSidebar } from '../cmps/sidebar/workspace-sidebar'
import { LoginLogoutModal } from '../cmps/modal/login-logout-modal'
import { CreateBoard } from '../cmps/modal/create-board'
import { Loader } from '../cmps/loader'
import { DueDate } from '../cmps/task/date-picker'
import { EstimateTimePicker, ActualTimePicker } from '../cmps/task/time-picker'

import { BsSun, BsCheckCircle } from 'react-icons/bs'
import { MdDragIndicator } from 'react-icons/md'
import { TbArrowsDiagonal } from 'react-icons/tb'
import { MdSend, MdExpandMore, MdExpandLess } from 'react-icons/md'

function isTaskToday(task) {
    if (task.isToday) return true
    if (task.dueDate) {
        const today = new Date()
        const due = new Date(task.dueDate)
        return due.toDateString() === today.toDateString()
    }
    return false
}

function ProgressConflictModal({ currentTask, pendingTask, onConfirm, onCancel }) {
    return (
        <div className="progress-conflict-overlay" onClick={onCancel}>
            <div className="progress-conflict-modal" onClick={e => e.stopPropagation()}>
                <h3>Task Already In Progress</h3>
                <p>
                    <strong>{currentTask.title}</strong> is currently in progress.
                    Stop it and start <strong>{pendingTask.title}</strong>?
                </p>
                <div className="progress-conflict-actions">
                    <button className="btn-secondary" onClick={onCancel}>Cancel</button>
                    <button className="btn-primary" onClick={onConfirm}>Stop &amp; Start</button>
                </div>
            </div>
        </div>
    )
}

function SummaryLabelPicker({ task, field, onUpdate }) {
    const [open, setOpen] = useState(false)
    const label = task.boardLabels?.find(l => l.title === task[field])
    const color = label?.color || '#c4c4c4'

    function onSelect(e, labelTitle) {
        e.stopPropagation()
        onUpdate(task, field, labelTitle)
        setOpen(false)
    }

    return (
        <section
            className="status-priority-picker picker"
            style={{ backgroundColor: color }}
            onClick={() => setOpen(o => !o)}
        >
            <div className={!task[field] ? 'empty-label label-text' : 'label-text'}>
                {task[field] || ''}
            </div>
            <span className="fold"></span>
            {open && (
                <ul className="summary-label-dropdown" onClick={e => e.stopPropagation()}>
                    {task.boardLabels?.filter(l => !l.type || l.type === field).map(l => (
                        <li key={l.id} style={{ backgroundColor: l.color }}
                            onClick={e => onSelect(e, l.title)}>
                            {l.title}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

function TaskSummaryRow({ task, onToggleToday, onUpdateField, dragHandleProps }) {
    const taskUrl = `/board/${task.boardId}/${task.groupId}/${task.id}`

    function onDateUpdate(field, val) {
        onUpdateField(task, field, val)
    }

    function onTimeUpdate(field, val) {
        onUpdateField(task, field, val)
    }

    return (
        <section className="task-summary-row flex">
            <div className="summary-sticky-div" style={{ borderColor: task.groupColor }}>
                {dragHandleProps && (
                    <div className="drag-handle" {...dragHandleProps}>
                        <MdDragIndicator />
                    </div>
                )}
                <div className="task-title picker flex align-center space-between">
                    <Link to={taskUrl} className="summary-title-link">
                        <span>{task.title}</span>
                    </Link>
                    <div className="summary-right-actions">
                        <Link to={taskUrl} className="open-task-details">
                            <TbArrowsDiagonal />
                            <span className="open-btn">Open</span>
                        </Link>
                        <button
                            className={`toggle-today-btn${task.isToday ? ' active' : ''}`}
                            onClick={() => onToggleToday(task)}
                            title={task.isToday ? 'Remove from Today' : 'Add to Today'}
                        >
                            <BsSun />
                        </button>
                    </div>
                </div>
            </div>
            <SummaryLabelPicker task={task} field="status" onUpdate={onUpdateField} />
            <DueDate info={task} onUpdate={onDateUpdate} />
            <SummaryLabelPicker task={task} field="priority" onUpdate={onUpdateField} />
            <EstimateTimePicker info={task} onUpdate={onTimeUpdate} />
            <ActualTimePicker info={task} onUpdate={onTimeUpdate} />
            <div className="board-name-end">
                <span className="board-name-chip">{task.boardTitle}</span>
            </div>
        </section>
    )
}

function TaskSection({ sectionId, title, tasks, onToggleToday, onUpdateField, icon, iconClass, isStatic, onSendNow }) {
    const [sendStatus, setSendStatus] = useState(null)

    async function handleSendNow() {
        if (!onSendNow) return
        setSendStatus('sending')
        try {
            const result = await onSendNow()
            if (result?.error) setSendStatus('error')
            else setSendStatus(result?.sent === false ? 'empty' : 'sent')
        } catch {
            setSendStatus('error')
        }
        setTimeout(() => setSendStatus(null), 3000)
    }

    return (
        <section className="task-section">
            <div className="task-section-header flex align-center">
                {icon && <span className={`section-icon${iconClass ? ` ${iconClass}` : ''}`}>{icon}</span>}
                <h2 className="task-section-title">{title}</h2>
                <span className="task-count">{tasks.length}</span>
                {onSendNow && (
                    <button
                        className={`send-now-header-btn${sendStatus ? ` status-${sendStatus}` : ''}`}
                        onClick={handleSendNow}
                        disabled={sendStatus === 'sending'}
                        title="Send today's tasks to Webex"
                    >
                        <MdSend />
                        <span className="send-label">
                            {sendStatus === 'sending' ? 'Sending…'
                                : sendStatus === 'sent' ? 'Sent!'
                                : sendStatus === 'empty' ? 'No tasks'
                                : sendStatus === 'error' ? 'Failed'
                                : 'Update'}
                        </span>
                    </button>
                )}
            </div>
            <div className="summary-col-headers flex">
                <div className="summary-col-title">Task</div>
                <div className="summary-col-picker">Status</div>
                <div className="summary-col-picker">Date</div>
                <div className="summary-col-picker">Priority</div>
                <div className="summary-col-picker">Est.</div>
                <div className="summary-col-picker">Actual</div>
                <div className="summary-col-board">Board</div>
            </div>
            {isStatic ? (
                <ul className="task-summary-list">
                    {tasks.length === 0 && (
                        <li><p className="no-tasks-msg">No tasks here.</p></li>
                    )}
                    {tasks.map(task => (
                        <li key={task.id}>
                            <TaskSummaryRow
                                task={task}
                                onToggleToday={onToggleToday}
                                onUpdateField={onUpdateField}
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <Droppable droppableId={sectionId}>
                    {(provided) => (
                        <ul
                            className="task-summary-list"
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                        >
                            {tasks.length === 0 && (
                                <li><p className="no-tasks-msg">No tasks here.</p></li>
                            )}
                            {tasks.map((task, idx) => (
                                <Draggable key={task.id} draggableId={task.id} index={idx}>
                                    {(dragProvided) => (
                                        <li
                                            ref={dragProvided.innerRef}
                                            {...dragProvided.draggableProps}
                                        >
                                            <TaskSummaryRow
                                                task={task}
                                                onToggleToday={onToggleToday}
                                                onUpdateField={onUpdateField}
                                                dragHandleProps={dragProvided.dragHandleProps}
                                            />
                                        </li>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </ul>
                    )}
                </Droppable>
            )}
        </section>
    )
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function WebexSettingsSection({ onSendNow, user }) {
    const [isOpen, setIsOpen] = useState(false)
    const [settings, setSettings] = useState({
        sendTime: '08:00',
        workingDays: [1, 2, 3, 4, 5],
        restDays: [],
        webexRoomName: 'DailyReport',
        webexRealtimeRoomName: 'RealTimeReport',
    })
    const [webexToken, setWebexToken] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState(null)
    const [sendStatus, setSendStatus] = useState(null)
    const [sendError, setSendError] = useState(null)

    useEffect(() => {
        notificationService.getSettings().then(s => {
            if (s) setSettings({
                sendTime: s.sendTime || '08:00',
                workingDays: s.workingDays ?? [1, 2, 3, 4, 5],
                restDays: s.restDays || [],
                webexRoomName: s.webexRoomName || 'DailyReport',
                webexRealtimeRoomName: s.webexRealtimeRoomName || 'RealTimeReport',
            })
        }).catch(() => {})
    }, [])

    function toggleDay(idx) {
        setSettings(s => ({
            ...s,
            workingDays: s.workingDays.includes(idx)
                ? s.workingDays.filter(d => d !== idx)
                : [...s.workingDays, idx].sort(),
        }))
    }

    function onRestDayPick(date) {
        const str = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        setSettings(s => ({
            ...s,
            restDays: s.restDays.includes(str)
                ? s.restDays.filter(d => d !== str)
                : [...s.restDays, str].sort(),
        }))
    }

    function removeRestDay(str) {
        setSettings(s => ({ ...s, restDays: s.restDays.filter(d => d !== str) }))
    }

    async function onSave() {
        setIsSaving(true)
        try {
            await notificationService.saveSettings(settings)
            if (webexToken && user?._id) {
                await userService.updateUser({ _id: user._id, webexToken })
                setWebexToken('')
            }
            setSaveMsg({ type: 'success', text: 'Settings saved!' })
        } catch {
            setSaveMsg({ type: 'error', text: 'Failed to save settings' })
        } finally {
            setIsSaving(false)
            setTimeout(() => setSaveMsg(null), 3000)
        }
    }

    async function handleSendNow() {
        setSendStatus('sending')
        setSendError(null)
        try {
            const result = await onSendNow()
            if (result?.error) { setSendStatus('error'); setSendError(result.error) }
            else setSendStatus(result?.sent === false ? 'empty' : 'sent')
        } catch {
            setSendStatus('error')
        }
        setTimeout(() => { setSendStatus(null); setSendError(null) }, 5000)
    }

    const restDateObjs = settings.restDays.map(d => new Date(d + 'T00:00:00'))

    return (
        <section className="webex-settings-section">
            <div className="webex-settings-header" onClick={() => setIsOpen(o => !o)}>
                <span className="webex-icon">💬</span>
                <span className="webex-title">Webex Digest</span>
                {settings.webexRoomName && <span className="webex-room-badge">{settings.webexRoomName}</span>}
                <span className="webex-chevron">{isOpen ? <MdExpandLess /> : <MdExpandMore />}</span>
            </div>

            {isOpen && (
                <div className="webex-settings-body">
                    <div className="settings-row">
                        <label className="settings-label">Webex Token</label>
                        <input
                            type="password"
                            className="text-input"
                            value={webexToken}
                            onChange={e => setWebexToken(e.target.value)}
                            placeholder="Enter new token to update"
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="settings-row">
                        <label className="settings-label">Daily Digest Room</label>
                        <input
                            type="text"
                            className="text-input"
                            value={settings.webexRoomName}
                            onChange={e => setSettings(s => ({ ...s, webexRoomName: e.target.value }))}
                            placeholder="DailyReport"
                        />
                    </div>

                    <div className="settings-row">
                        <label className="settings-label">Realtime Room</label>
                        <input
                            type="text"
                            className="text-input"
                            value={settings.webexRealtimeRoomName}
                            onChange={e => setSettings(s => ({ ...s, webexRealtimeRoomName: e.target.value }))}
                            placeholder="RealTimeReport"
                        />
                    </div>

                    <div className="settings-row">
                        <label className="settings-label">Send Time</label>
                        <input
                            type="time"
                            className="time-input"
                            value={settings.sendTime}
                            onChange={e => setSettings(s => ({ ...s, sendTime: e.target.value }))}
                        />
                    </div>

                    <div className="settings-row">
                        <label className="settings-label">Working Days</label>
                        <div className="day-toggles">
                            {DAY_LABELS.map((day, i) => (
                                <button
                                    key={i}
                                    className={`day-toggle-btn${settings.workingDays.includes(i) ? ' active' : ''}`}
                                    onClick={() => toggleDay(i)}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="settings-row settings-row--top">
                        <label className="settings-label">Rest Days</label>
                        <div className="rest-days-col">
                            <DatePicker
                                onChange={onRestDayPick}
                                highlightDates={restDateObjs}
                                placeholderText="Click a date to mark as rest day"
                                inline
                                calendarClassName="rest-day-calendar"
                            />
                            {settings.restDays.length > 0 && (
                                <div className="rest-days-chips">
                                    {settings.restDays.map(d => (
                                        <span key={d} className="rest-day-chip">
                                            {d}
                                            <button className="chip-remove" onClick={() => removeRestDay(d)}>×</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="settings-actions">
                        <button className="settings-save-btn" onClick={onSave} disabled={isSaving}>
                            {isSaving ? 'Saving…' : 'Save Settings'}
                        </button>
                        <button
                            className={`settings-send-btn${sendStatus ? ` status-${sendStatus}` : ''}`}
                            onClick={handleSendNow}
                            disabled={sendStatus === 'sending'}
                        >
                            <MdSend />
                            {sendStatus === 'sending' ? 'Sending…'
                                : sendStatus === 'sent' ? 'Sent!'
                                : sendStatus === 'empty' ? 'No tasks'
                                : sendStatus === 'error' ? 'Failed'
                                : 'Send Now'}
                        </button>
                        {saveMsg && (
                            <span className={`settings-msg settings-msg--${saveMsg.type}`}>{saveMsg.text}</span>
                        )}
                        {sendError && (
                            <span className="settings-msg settings-msg--error">{sendError}</span>
                        )}
                    </div>
                </div>
            )}
        </section>
    )
}

export function MemberSummary() {
    const boards = useSelector(s => s.boardModule.boards)
    const user = useSelector(s => s.userModule.user)

    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
    const [workspaceDisplay, setWorkspaceDisplay] = useState('board')
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [progressConflict, setProgressConflict] = useState(null)

    useEffect(() => {
        loadBoards()
        loadUsers()
    }, [])

    const allMemberTasks = useMemo(() => {
        if (!boards.length || !user) return []
        return boardService.getMemberTasksFromBoards(boards, user._id)
    }, [boards, user])

    const doneTasks = useMemo(() => allMemberTasks.filter(t => t.status === 'Done'), [allMemberTasks])
    const todayTasks = useMemo(() => allMemberTasks.filter(t => t.status !== 'Done' && isTaskToday(t)), [allMemberTasks])
    const otherTasks = useMemo(() => allMemberTasks.filter(t => t.status !== 'Done' && !isTaskToday(t)), [allMemberTasks])

    async function onToggleToday(enrichedTask) {
        const { boardId, boardTitle, groupId, groupTitle, groupColor, boardLabels, ...taskToSave } = enrichedTask
        taskToSave.isToday = !taskToSave.isToday
        await boardService.updateTask(boardId, groupId, taskToSave)
        await loadBoards()
    }

    async function _doUpdateField(enrichedTask, field, value) {
        const { boardId, boardTitle, groupId, groupTitle, groupColor, boardLabels, ...taskToSave } = enrichedTask
        taskToSave[field] = value
        if (field === 'actualTime' && taskToSave.status === 'Progress') {
            taskToSave.progressStartedAt = Date.now()
        }
        await boardService.updateTask(boardId, groupId, taskToSave)
        await loadBoards()
    }

    async function onUpdateField(enrichedTask, field, value) {
        if (field === 'status' && value === 'Progress') {
            const currentProgressTask = allMemberTasks.find(
                t => t.status === 'Progress' && t.id !== enrichedTask.id
            )
            if (currentProgressTask) {
                setProgressConflict({
                    currentTask: currentProgressTask,
                    pendingTask: enrichedTask,
                    pendingField: field,
                    pendingValue: value
                })
                return
            }
        }
        await _doUpdateField(enrichedTask, field, value)
    }

    async function onProgressConflictConfirm() {
        const { currentTask, pendingTask, pendingField, pendingValue } = progressConflict
        setProgressConflict(null)
        await _doUpdateField(currentTask, 'status', 'Pause')
        await _doUpdateField(pendingTask, pendingField, pendingValue)
    }

    function onProgressConflictCancel() {
        setProgressConflict(null)
    }

    function onSendNow() {
        return notificationService.sendNow()
    }

    async function onDragEnd(result) {
        if (!result.destination) return
        const { source, destination } = result
        if (source.droppableId === destination.droppableId) return

        const allTasks = [...todayTasks, ...otherTasks]
        const task = allTasks.find(t => t.id === result.draggableId)
        if (!task) return

        const movingToToday = destination.droppableId === 'today'
        const { boardId, groupId, boardTitle, groupTitle, groupColor, boardLabels, ...taskToSave } = task
        taskToSave.isToday = movingToToday
        await boardService.updateTask(boardId, groupId, taskToSave)
        await loadBoards()
    }

    if (!boards.length) return <Loader />

    return (
        <section className="member-summary flex">
            <div className="sidebar flex">
                <MainSidebar
                    setWorkspaceDisplay={setWorkspaceDisplay}
                    setIsWorkspaceOpen={setIsWorkspaceOpen}
                    setIsLoginModalOpen={setIsLoginModalOpen}
                />
                <WorkspaceSidebar
                    workspaceDisplay={workspaceDisplay}
                    isWorkspaceOpen={isWorkspaceOpen}
                    setIsWorkspaceOpen={setIsWorkspaceOpen}
                    setIsCreateModalOpen={setIsCreateModalOpen}
                />
            </div>
            <main className="board-main member-summary-main">
                <header className="member-summary-header flex align-center">
                    {user?.imgUrl && (
                        <img className="member-avatar" src={user.imgUrl} alt={user.fullname} />
                    )}
                </header>
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="task-sections">
                        <TaskSection
                            sectionId="today"
                            title="Today"
                            tasks={todayTasks}
                            onToggleToday={onToggleToday}
                            onUpdateField={onUpdateField}
                            icon={<BsSun />}
                            onSendNow={onSendNow}
                        />
                        <TaskSection
                            sectionId="others"
                            title="Others"
                            tasks={otherTasks}
                            onToggleToday={onToggleToday}
                            onUpdateField={onUpdateField}
                        />
                    </div>
                </DragDropContext>
                <div className="task-sections">
                    <TaskSection
                        title="Done"
                        tasks={doneTasks}
                        onToggleToday={onToggleToday}
                        onUpdateField={onUpdateField}
                        icon={<BsCheckCircle />}
                        iconClass="done-icon"
                        isStatic
                    />
                </div>
                <WebexSettingsSection onSendNow={onSendNow} user={user} />
            </main>
            {isLoginModalOpen && <LoginLogoutModal setIsLoginModalOpen={setIsLoginModalOpen} />}
            {isCreateModalOpen && <CreateBoard setIsCreateModalOpen={setIsCreateModalOpen} />}
            {progressConflict && (
                <ProgressConflictModal
                    currentTask={progressConflict.currentTask}
                    pendingTask={progressConflict.pendingTask}
                    onConfirm={onProgressConflictConfirm}
                    onCancel={onProgressConflictCancel}
                />
            )}
        </section>
    )
}
