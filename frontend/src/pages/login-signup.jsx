import { useState } from 'react'
import { ImgUploader } from '../cmps/login/img-uploader'
import { LoginPageHeader } from '../cmps/login/login-page-header'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { login, signup } from '../store/user.actions'
import { Loader } from '../cmps/loader'

export function LoginSignup() {
    const [credentials, setCredentials] = useState({ username: '', password: '', fullname: '' })
    const [isSignup, setIsSignup] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const navigate = useNavigate()
    const user = useSelector(s => s.userModule.user)
    const isLoadingUser = useSelector(s => s.userModule.isLoadingUser)

    function handleChange(ev) {
        const field = ev.target.name
        const value = ev.target.value
        setCredentials({ ...credentials, [field]: value })
        if (errorMsg) setErrorMsg('')
    }

    async function onSubmit(ev, isSignup) {
        ev.preventDefault()
        if (!credentials.username || !credentials.password) return
        try {
            let loggedUser
            if (isSignup) {
                if (!credentials.fullname) return
                loggedUser = await signup(credentials)
            } else {
                loggedUser = await login(credentials)
            }
            navigate(`/member/${loggedUser._id}`)
        } catch (err) {
            setErrorMsg(isSignup ? 'Sign up failed. Username may already be taken.' : 'Incorrect username or password.')
        }
    }

    function toggleSignup() {
        setIsSignup(!isSignup)
    }

    function onUploaded(imgUrl) {
        setCredentials({ ...credentials, imgUrl })
    }

    if (isLoadingUser) return <Loader />
    if (user) return <Navigate to={`/member/${user._id}`} replace />

    return (
        <div className="login-signup">
            <LoginPageHeader />
            <form className="form-container layout" onSubmit={(ev) => onSubmit(ev, isSignup)}>
                <h1>{isSignup ? 'Create your MyDay account here ' : 'Log in to your account'}</h1>
                {isSignup && <ImgUploader onUploaded={onUploaded} />}
                {!isSignup && <p className="login-explain">Enter your username and password</p>}
                {isSignup && <p className="login-explain">Enter your full name, username and password</p>}
                {isSignup &&
                <input
                    type="text"
                    name="fullname"
                    value={credentials.fullname}
                    placeholder="Full name"
                    onChange={handleChange}
                    required
                    autoFocus
                />}
                <input
                    type="text"
                    name="username"
                    value={credentials.username}
                    placeholder="Username"
                    onChange={handleChange}
                    required
                    autoFocus
                />
                {
                    <input
                        type="password"
                        name="password"
                        value={credentials.password}
                        placeholder="Password"
                        onChange={handleChange}
                        required
                    />
                }
                {errorMsg && <p className="login-error">{errorMsg}</p>}
                <button className="btn-next">{isSignup ? 'Sign up' : 'Log in'}</button>
                <div className="suggest-signup">
                    <span className="suggest-signup-prefix">{isSignup ? 'Already have an account?' : 'Don\'t have an account yet?'}</span>
                    {!isSignup && <Link to={'/auth/signup'}><button className="btn-signup" onClick={toggleSignup}>Sign up</button></Link>}
                    {isSignup && <Link to={'/auth/login'}><button className="btn-signup" onClick={toggleSignup}>Log in</button></Link>}
                </div>
            </form>
        </div>
    )
}
