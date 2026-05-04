import { useEffect, useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'

import { loadBoards } from '../store/board.actions'
import { loadUsers } from '../store/user.actions'
import { boardService } from '../services/board.service'

import { MainSidebar } from '../cmps/sidebar/main-sidebar'
import { WorkspaceSidebar } from '../cmps/sidebar/workspace-sidebar'
import { LoginLogoutModal } from '../cmps/modal/login-logout-modal'
import { CreateBoard } from '../cmps/modal/create-board'
import { Loader } from '../cmps/loader'
import { DueDate } from '../cmps/task/date-picker'

import { BsSun, BsCheckCircle } from 'react-icons/bs'
import { MdDragIndicator } from 'react-icons/md'
import { TbArrowsDiagonal } from 'react-icons/tb'

function isTaskToday(task) {
    if (task.isToday) return true
    if (task.dueDate) {
        const today = new Date()
        const due = new Date(task.dueDate)
        return due.toDateString() === today.toDateString()
    }
    return false
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
                    {task.boardLabels?.map(l => (
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
            <div className="board-name-end">
                <span className="board-name-chip">{task.boardTitle}</span>
            </div>
        </section>
    )
}

function TaskSection({ sectionId, title, tasks, onToggleToday, onUpdateField, icon, iconClass, isStatic }) {
    return (
        <section className="task-section">
            <div className="task-section-header flex align-center">
                {icon && <span className={`section-icon${iconClass ? ` ${iconClass}` : ''}`}>{icon}</span>}
                <h2 className="task-section-title">{title}</h2>
                <span className="task-count">{tasks.length}</span>
            </div>
            <div className="summary-col-headers flex">
                <div className="summary-col-title">Task</div>
                <div className="summary-col-picker">Status</div>
                <div className="summary-col-picker">Date</div>
                <div className="summary-col-picker">Priority</div>
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

export function MemberSummary() {
    const boards = useSelector(s => s.boardModule.boards)
    const user = useSelector(s => s.userModule.user)

    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
    const [workspaceDisplay, setWorkspaceDisplay] = useState('board')
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

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

    async function onUpdateField(enrichedTask, field, value) {
        const { boardId, boardTitle, groupId, groupTitle, groupColor, boardLabels, ...taskToSave } = enrichedTask
        taskToSave[field] = value
        await boardService.updateTask(boardId, groupId, taskToSave)
        await loadBoards()
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
                    <h1 className="member-summary-title">My Tasks</h1>
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
            </main>
            {isLoginModalOpen && <LoginLogoutModal setIsLoginModalOpen={setIsLoginModalOpen} />}
            {isCreateModalOpen && <CreateBoard setIsCreateModalOpen={setIsCreateModalOpen} />}
        </section>
    )
}
