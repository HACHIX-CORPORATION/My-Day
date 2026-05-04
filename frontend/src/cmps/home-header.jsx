import { Link } from 'react-router-dom'
import { HiOutlineArrowRight } from 'react-icons/hi'
import { useSelector } from 'react-redux'
import Logo from './logo'


export function HomeHeader ({ boards }) {
    const user = useSelector(s => s.userModule.user)
    return (
        <header className="home-header">
               <Logo />
                <div className='header-btns'>
                    {!user && <Link to={'/auth/login'}><button className="btn-login">Log in</button></Link>}
                    <Link to={`/board/${boards[0]._id}`}><button className='btn-start'>Get started <span className="arrow"><HiOutlineArrowRight /></span></button></Link>
                </div>
        </header>
    )
}
