import { useEffect, useState } from 'react'
import { MainSidebar } from '../cmps/sidebar/main-sidebar'
import { WorkspaceSidebar } from '../cmps/sidebar/workspace-sidebar'
import { LoginLogoutModal } from '../cmps/modal/login-logout-modal'
import { userService } from '../services/user.service'

const guest = 'https://res.cloudinary.com/du63kkxhl/image/upload/v1675013009/guest_f8d60j.png'

export function UserManagement() {
    const [users, setUsers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
    const [workspaceDisplay, setWorkspaceDisplay] = useState('board')

    useEffect(() => { loadUsers() }, [])

    async function loadUsers() {
        try {
            setIsLoading(true)
            const data = await userService.getUsers()
            setUsers(data)
        } finally {
            setIsLoading(false)
        }
    }

    async function onDelete(userId) {
        await userService.remove(userId)
        setConfirmDeleteId(null)
        setUsers(prev => prev.filter(u => u._id !== userId))
    }

    return (
        <div className="user-management-page flex">
            <MainSidebar
                setIsLoginModalOpen={setIsLoginModalOpen}
                setWorkspaceDisplay={setWorkspaceDisplay}
                setIsWorkspaceOpen={setIsWorkspaceOpen}
            />
            {isWorkspaceOpen && (
                <WorkspaceSidebar
                    display={workspaceDisplay}
                    setIsWorkspaceOpen={setIsWorkspaceOpen}
                />
            )}
            <main className="user-management-main">
                <h1 className="user-management-title">User Management</h1>
                {isLoading ? (
                    <p className="user-management-loading">Loading users...</p>
                ) : (
                    <table className="user-management-table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Full Name</th>
                                <th>Username</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user._id} className="user-management-row">
                                    <td>
                                        <img
                                            className="user-management-avatar"
                                            src={user.imgUrl || guest}
                                            alt={user.fullname}
                                        />
                                    </td>
                                    <td className="user-management-fullname">{user.fullname}</td>
                                    <td className="user-management-username">@{user.username}</td>
                                    <td className="user-management-actions">
                                        {user.username !== 'admin@hachi-x.com' && (
                                            confirmDeleteId === user._id ? (
                                                <div className="user-management-confirm">
                                                    <span>Delete?</span>
                                                    <button className="btn-danger" onClick={() => onDelete(user._id)}>Yes</button>
                                                    <button className="btn-secondary" onClick={() => setConfirmDeleteId(null)}>No</button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => setConfirmDeleteId(user._id)}
                                                >
                                                    Delete
                                                </button>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </main>
            {isLoginModalOpen && (
                <LoginLogoutModal setIsLoginModalOpen={setIsLoginModalOpen} />
            )}
        </div>
    )
}
