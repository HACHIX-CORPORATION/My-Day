import { useEffect, useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'

import { loadBoards } from '../store/board.actions'
import { loadUsers } from '../store/user.actions'
import { boardService } from '../services/board.service'
import { utilService } from '../services/util.service'

import { MainSidebar } from '../cmps/sidebar/main-sidebar'
import { WorkspaceSidebar } from '../cmps/sidebar/workspace-sidebar'
import { LoginLogoutModal } from '../cmps/modal/login-logout-modal'
import { CreateBoard } from '../cmps/modal/create-board'
import { Loader } from '../cmps/loader'

import { BsSun } from 'react-icons/bs'

function isTaskToday(task) {
    if (task.isToday) return true
    if (task.dueDate) {
        const today = new Date()
        const due = new Date(task.dueDate)
        return due.toDateString() === today.toDateString()
    }
    return false
}

function TaskSummaryRow({ task, onToggleToday }) {
    const taskUrl = `/board/${task.boardId}/${task.groupId}/${task.id}`
    const isDueToday = task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString()

    return (
        <div className="task-summary-row flex align-center">
            <span className="group-color-dot" style={{ backgroundColor: task.groupColor }} />
            <Link to={taskUrl} className="task-summary-title">{task.title}</Link>
            <span className="board-name-chip">{task.boardTitle}</span>
            {task.dueDate && (
                <span className={`due-date-badge${isDueToday ? ' due-today' : ''}`}>
                    {utilService.getFormattedDate(task.dueDate)}
                </span>
            )}
            <button
                className={`toggle-today-btn${task.isToday ? ' active' : ''}`}
                onClick={() => onToggleToday(task)}
                title={task.isToday ? 'Remove from Today' : 'Add to Today'}
            >
                <BsSun />
            </button>
        </div>
    )
}

function TaskSection({ title, tasks, onToggleToday, icon }) {
    return (
        <section className="task-section">
            <div className="task-section-header flex align-center">
                {icon && <span className="section-icon">{icon}</span>}
                <h2 className="task-section-title">{title}</h2>
                <span className="task-count">{tasks.length}</span>
            </div>
            {tasks.length === 0 ? (
                <p className="no-tasks-msg">No tasks here.</p>
            ) : (
                <ul className="task-summary-list">
                    {tasks.map(task => (
                        <li key={`${task.boardId}-${task.id}`}>
                            <TaskSummaryRow task={task} onToggleToday={onToggleToday} />
                        </li>
                    ))}
                </ul>
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

    const todayTasks = useMemo(() => allMemberTasks.filter(isTaskToday), [allMemberTasks])
    const otherTasks = useMemo(() => allMemberTasks.filter(t => !isTaskToday(t)), [allMemberTasks])

    async function onToggleToday(enrichedTask) {
        const { boardId, boardTitle, groupId, groupTitle, groupColor, ...taskToSave } = enrichedTask
        taskToSave.isToday = !taskToSave.isToday
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
                <div className="task-sections">
                    <TaskSection
                        title="Today"
                        tasks={todayTasks}
                        onToggleToday={onToggleToday}
                        icon={<BsSun />}
                    />
                    <TaskSection
                        title="Others"
                        tasks={otherTasks}
                        onToggleToday={onToggleToday}
                    />
                </div>
            </main>
            {isLoginModalOpen && <LoginLogoutModal setIsLoginModalOpen={setIsLoginModalOpen} />}
            {isCreateModalOpen && <CreateBoard setIsCreateModalOpen={setIsCreateModalOpen} />}
        </section>
    )
}
