import React, { useRef } from 'react'
import { BsArrowDownCircle } from 'react-icons/bs'
import { CgViewComfortable } from 'react-icons/cg'
import { useSelector } from 'react-redux'
import { addGroup, importGroupsToBoard, setDynamicModalObj } from '../../store/board.actions'

export function AddGroupModal({ dynamicModalObj }) {
    const board = useSelector(storeState => storeState.boardModule.filteredBoard)
    const fileInputRef = useRef()

    function onAddGroup() {
        try {
            addGroup(board)
            dynamicModalObj.isOpen = false
            setDynamicModalObj(dynamicModalObj)
        } catch (err) {
            console.log('cant add group:', err)
        }
    }

    function onImportTasks() {
        fileInputRef.current.click()
    }

    async function onFileSelected(ev) {
        const file = ev.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (e) => {
            try {
                await importGroupsToBoard(new Uint8Array(e.target.result), board)
                dynamicModalObj.isOpen = false
                setDynamicModalObj(dynamicModalObj)
            } catch (err) {
                console.log('Import failed:', err)
            }
        }
        reader.readAsArrayBuffer(file)
    }

    return (
        <div className='add-group-modal'>
            <div className='add-group' onClick={onAddGroup}>
                <CgViewComfortable className='icon' />
                <span>New group of Tasks</span>
            </div>
            <div className='import-tasks' onClick={onImportTasks}>
                <BsArrowDownCircle className='icon' />
                <span>Import tasks</span>
                <input
                    ref={fileInputRef}
                    type='file'
                    accept='.xlsx'
                    onChange={onFileSelected}
                    style={{ display: 'none' }}
                />
            </div>
        </div>
    )
}
