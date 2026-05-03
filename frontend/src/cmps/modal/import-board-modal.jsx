import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { AiOutlineClose } from 'react-icons/ai'
import { BsCloudUpload } from 'react-icons/bs'
import { importService } from '../../services/import.service'
import { boardService } from '../../services/board.service'
import { store } from '../../store/store'
import { ADD_BOARD } from '../../store/board.reducer'
import { loadBoards } from '../../store/board.actions'

export function ImportBoardModal({ onClose }) {
    const [parsed, setParsed] = useState(null)
    const [boardTitle, setBoardTitle] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const fileInputRef = useRef()
    const navigate = useNavigate()
    const user = useSelector(state => state.userModule.user)

    function onFileChange(ev) {
        const file = ev.target.files[0]
        if (!file) return
        setError('')
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const result = importService.parseMondayXLSX(new Uint8Array(e.target.result))
                if (!result.groups.length) {
                    setError('No groups found. Make sure this is a Monday.com .xlsx export.')
                    return
                }
                setParsed(result)
                setBoardTitle(result.boardTitle)
            } catch {
                setError('Could not parse file. Make sure it is a Monday.com .xlsx export.')
            }
        }
        reader.readAsArrayBuffer(file)
    }

    async function onImport() {
        if (!parsed || !boardTitle.trim()) return
        setIsLoading(true)
        try {
            const board = importService.buildBoardFromImport({ ...parsed, boardTitle: boardTitle.trim() }, user)
            const newBoard = await boardService.save(board)
            store.dispatch({ type: ADD_BOARD, board: newBoard })
            await loadBoards()
            onClose()
            navigate(`/board/${newBoard._id}`)
        } catch {
            setError('Import failed. Please try again.')
            setIsLoading(false)
        }
    }

    const totalTasks = parsed ? parsed.groups.reduce((sum, g) => sum + g.tasks.length, 0) : 0

    return (
        <>
            <div className='dark-screen' onClick={onClose} />
            <section className='import-board-modal flex column'>
                <div className='close' onClick={onClose}>
                    <AiOutlineClose className='icon' />
                </div>
                <h1>Import from Monday.com</h1>

                <div className='drop-zone flex column align-center' onClick={() => fileInputRef.current.click()}>
                    <BsCloudUpload className='upload-icon' />
                    <span>Click to select a .xlsx file</span>
                    <span className='hint'>Export your Monday.com board as Excel and upload here</span>
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept='.xlsx'
                        onChange={onFileChange}
                        style={{ display: 'none' }}
                    />
                </div>

                {error && <p className='import-error'>{error}</p>}

                {parsed && (
                    <div className='import-preview flex column'>
                        <label>Board name</label>
                        <input
                            type='text'
                            value={boardTitle}
                            onChange={e => setBoardTitle(e.target.value)}
                        />
                        <p className='preview-summary'>
                            Found <strong>{parsed.groups.length}</strong> groups and <strong>{totalTasks}</strong> tasks
                        </p>
                        <button
                            className='import-btn'
                            onClick={onImport}
                            disabled={isLoading || !boardTitle.trim()}
                        >
                            {isLoading ? 'Importing...' : 'Import board'}
                        </button>
                    </div>
                )}
            </section>
        </>
    )
}
