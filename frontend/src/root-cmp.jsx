import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router'
import { Provider } from 'react-redux'
import { useSelector } from 'react-redux'
import { BoardDetails } from './pages/board-details'
import HomePage from './pages/home-page'
import { LoginSignup } from './pages/login-signup'
import { MemberSummary } from './pages/member-summary'
import { UserManagement } from './pages/user-management'
import { store } from './store/store'
import { initUser } from './store/user.actions'
import { Loader } from './cmps/loader'

function AppInit() {
    useEffect(() => { initUser() }, [])
    return null
}

function RequireAuth({ children }) {
    const user = useSelector(s => s.userModule.user)
    const isLoadingUser = useSelector(s => s.userModule.isLoadingUser)
    if (isLoadingUser) return <Loader />
    if (!user) return <Navigate to="/auth/login" replace />
    return children
}

function RequireAdmin({ children }) {
    const user = useSelector(s => s.userModule.user)
    const isLoadingUser = useSelector(s => s.userModule.isLoadingUser)
    if (isLoadingUser) return <Loader />
    if (!user || user.username !== 'admin@hachi-x.com') return <Navigate to="/" replace />
    return children
}

function HomeRedirect() {
    const user = useSelector(s => s.userModule.user)
    const isLoadingUser = useSelector(s => s.userModule.isLoadingUser)
    if (isLoadingUser) return <Loader />
    if (user) return <Navigate to={`/member/${user._id}`} replace />
    return <HomePage />
}

export function RootCmp () {
    return (
        <Provider store={store}>
            <AppInit />
            <div>
                <main>
                    <Routes>
                        <Route element={<HomeRedirect />} path='/' />
                        <Route element={<RequireAuth><BoardDetails /></RequireAuth>} path='/board/:boardId/' />
                        <Route element={<RequireAuth><BoardDetails /></RequireAuth>} path='/board/:boardId/:groupId/:taskId' />
                        <Route element={<RequireAuth><BoardDetails /></RequireAuth>} path='/board/:boardId/:activityLog' />
                        <Route element={<LoginSignup />} path='/auth/login' />
                        <Route element={<LoginSignup />} path='/auth/signup' />
                        <Route element={<RequireAuth><MemberSummary /></RequireAuth>} path='/member/:memberId' />
                        <Route element={<RequireAdmin><UserManagement /></RequireAdmin>} path='/admin/users' />
                    </Routes>
                </main>
            </div>
        </Provider>
    )
}
