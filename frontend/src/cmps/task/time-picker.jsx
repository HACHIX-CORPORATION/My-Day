import { useEffect, useRef, useState } from "react"

function formatMinutes(mins) {
    if (!mins || mins <= 0) return '—'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}

function parseMinutes(str) {
    if (!str) return 0
    const s = String(str).trim()
    // Plain number → interpret as minutes
    if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, Math.round(parseFloat(s)))
    // "Xh Ym" / "Xh" / "Ym" format
    let total = 0
    const hMatch = s.match(/(\d+(\.\d+)?)\s*h/)
    const mMatch = s.match(/(\d+)\s*m/)
    if (hMatch) total += parseFloat(hMatch[1]) * 60
    if (mMatch) total += parseInt(mMatch[1])
    return Math.max(0, Math.round(total))
}

export function EstimateTimePicker({ info, onUpdate }) {
    const [isEditing, setIsEditing] = useState(false)
    const [inputVal, setInputVal] = useState('')
    const inputRef = useRef(null)

    useEffect(() => {
        if (isEditing && inputRef.current) inputRef.current.focus()
    }, [isEditing])

    function onClickDisplay() {
        setInputVal(info.estimateTime ? String(info.estimateTime) : '')
        setIsEditing(true)
    }

    function onSave() {
        const mins = parseMinutes(inputVal)
        onUpdate('estimateTime', mins)
        setIsEditing(false)
    }

    function onKeyDown(ev) {
        if (ev.key === 'Enter') onSave()
        if (ev.key === 'Escape') setIsEditing(false)
    }

    return (
        <section className="time-picker picker estimate-time-picker" onClick={!isEditing ? onClickDisplay : undefined}>
            {isEditing ? (
                <input
                    ref={inputRef}
                    className="time-picker-input"
                    type="text"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onBlur={onSave}
                    onKeyDown={onKeyDown}
                    placeholder="e.g. 2h 30m"
                />
            ) : (
                <span className="time-display">{formatMinutes(info.estimateTime)}</span>
            )}
        </section>
    )
}

export function ActualTimePicker({ info, onUpdate }) {
    const [isEditing, setIsEditing] = useState(false)
    const [inputVal, setInputVal] = useState('')
    const [, setTick] = useState(0)
    const inputRef = useRef(null)

    const isLive = info.status === 'Progress' && !!info.progressStartedAt

    useEffect(() => {
        if (!isLive) return
        const id = setInterval(() => setTick(t => t + 1), 30000)
        return () => clearInterval(id)
    }, [isLive, info.progressStartedAt])

    useEffect(() => {
        if (isEditing && inputRef.current) inputRef.current.focus()
    }, [isEditing])

    function getLiveMinutes() {
        const base = info.actualTime || 0
        if (!isLive) return base
        return base + Math.floor((Date.now() - info.progressStartedAt) / 60000)
    }

    function onClickDisplay() {
        setInputVal(getLiveMinutes() ? String(getLiveMinutes()) : '')
        setIsEditing(true)
    }

    function onSave() {
        const mins = parseMinutes(inputVal)
        onUpdate('actualTime', mins)
        setIsEditing(false)
    }

    function onKeyDown(ev) {
        if (ev.key === 'Enter') onSave()
        if (ev.key === 'Escape') setIsEditing(false)
    }

    return (
        <section className={`time-picker picker actual-time-picker${isLive ? ' is-live' : ''}`} onClick={!isEditing ? onClickDisplay : undefined}>
            {isLive && <span className="live-dot" title="Timer running" />}
            {isEditing ? (
                <input
                    ref={inputRef}
                    className="time-picker-input"
                    type="text"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onBlur={onSave}
                    onKeyDown={onKeyDown}
                    placeholder="e.g. 2h 30m"
                />
            ) : (
                <span className="time-display">{formatMinutes(getLiveMinutes())}</span>
            )}
        </section>
    )
}
