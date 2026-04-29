import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

const RADIUS = 20
const FADE = 3000

function App() {
  const canvasRef = useRef(null)
  const [points, setPoints] = useState([])
  const [playing, setPlaying] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [pointCount, setPointCount] = useState(5)
  const [nextIdx, setNextIdx] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [notification, setNotification] = useState("Let's play game")
  const [hint, setHint] = useState('Next: 1')
  
  const fadeIdsRef = useRef([])
  const stateRef = useRef({ autoPlay: false, playing: false, points: [], nextIdx: 0 })

  // Keep state ref in sync
  useEffect(() => {
    stateRef.current = { autoPlay, playing, points, nextIdx }
  }, [autoPlay, playing, points, nextIdx])

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 400, 400)
    
    const sorted = [...points].sort((a, b) => b.id - a.id)
    sorted.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = p.error ? '#dc3545' : (p.clicked ? '#28a745' : '#007bff')
      ctx.globalAlpha = p.opacity
      ctx.fill()
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.stroke()
      
      ctx.fillStyle = 'white'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const isFading = p.fadeTime !== undefined
      const yPos = isFading ? p.y - 8 : p.y
      ctx.fillText(p.id, p.x, yPos)
      
      if (isFading) {
        const remaining = Math.max(0, (FADE - (Date.now() - p.fadeTime)) / 1000)
        ctx.font = 'bold 11px Arial'
        ctx.fillText(remaining.toFixed(1), p.x, p.y + 8)
      }
      ctx.globalAlpha = 1
    })
  }, [points])

  // Update timer
  useEffect(() => {
    if (!playing || !startTime) return
    
    const timer = setInterval(() => {
      setElapsed((Date.now() - startTime) / 1000)
    }, 100)
    
    return () => clearInterval(timer)
  }, [playing, startTime])

  const generatePoints = (count) => {
    const newPoints = []
    for (let i = 1; i <= count; i++) {
      const pad = RADIUS + 5
      const x = Math.random() * (400 - 2 * pad) + pad
      const y = Math.random() * (400 - 2 * pad) + pad
      newPoints.push({ id: i, x, y, clicked: false, opacity: 1, error: false })
    }
    return newPoints
  }

  const endGame = useCallback((lost) => {
    setPlaying(false)
    setNotification(lost ? 'Game Over' : 'All Cleared')
    if (lost) fadeIdsRef.current.forEach(id => clearInterval(id))
    fadeIdsRef.current = []
  }, [])

  const processClick = useCallback((clickedPoint) => {
    const { playing: isPlaying, points: currentPoints, nextIdx: currentNextIdx, autoPlay: isAutoPlay } = stateRef.current
    
    if (clickedPoint.clicked || !isPlaying) return
    
    const next = currentPoints[currentNextIdx]
    
    if (clickedPoint.id === next.id) {
      const updatedPoints = currentPoints.map(p => 
        p.id === clickedPoint.id ? { ...p, clicked: true } : p
      )
      setPoints(updatedPoints)
      
      const newNextIdx = currentNextIdx + 1
      setNextIdx(newNextIdx)
      setHint(newNextIdx < updatedPoints.length ? `Next: ${updatedPoints[newNextIdx].id}` : 'Complete!')

      // Fade animation
      const p = updatedPoints.find(pt => pt.id === clickedPoint.id)
      p.fadeTime = Date.now()
      
      const fadeInterval = setInterval(() => {
        const prog = (Date.now() - p.fadeTime) / FADE
        if (prog >= 1) {
          setPoints(current => current.map(pt => pt.id === p.id ? { ...pt, opacity: 0 } : pt))
          clearInterval(fadeInterval)
          fadeIdsRef.current = fadeIdsRef.current.filter(id => id !== fadeInterval)
        } else {
          setPoints(current => current.map(pt => pt.id === p.id ? { ...pt, opacity: 1 - prog } : pt))
        }
      }, 30)
      fadeIdsRef.current.push(fadeInterval)

      if (newNextIdx === updatedPoints.length) {
        setTimeout(() => endGame(false), FADE)
      } else if (isAutoPlay) {
        setTimeout(() => processClick(updatedPoints[newNextIdx]), 1000)
      }
    } else {
      fadeIdsRef.current.forEach(id => clearInterval(id))
      fadeIdsRef.current = []
      const updatedPoints = currentPoints.map(p => p.id === clickedPoint.id ? { ...p, error: true } : p)
      setPoints(updatedPoints)
      setTimeout(() => endGame(true), 500)
    }
  }, [endGame])

  const handleStart = () => {
    const count = Math.max(1, Math.min(2000, pointCount))
    const newPoints = generatePoints(count)
    setPoints(newPoints)
    setPlaying(true)
    setAutoPlay(false)
    setNextIdx(0)
    setStartTime(Date.now())
    setElapsed(0)
    setNotification("Let's play game")
    setHint('Next: 1')
  }

  const handleAutoPlayToggle = () => {
    const newAutoPlayState = !autoPlay
    setAutoPlay(newAutoPlayState)
    if (newAutoPlayState && stateRef.current.points.length > 0) {
      setTimeout(() => {
        const nextPoint = stateRef.current.points[stateRef.current.nextIdx]
        if (nextPoint && !nextPoint.clicked) processClick(nextPoint)
      }, 500)
    }
  }

  const handleCanvasClick = (e) => {
    if (!stateRef.current.playing) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const sorted = [...stateRef.current.points].sort((a, b) => a.id - b.id)
    
    for (const p of sorted) {
      if (p.clicked) continue
      const dist = Math.hypot(e.clientX - rect.left - p.x, e.clientY - rect.top - p.y)
      if (dist <= RADIUS) {
        processClick(p)
        return
      }
    }
  }

  const notificationClass = playing || notification === "Let's play game" ? '' : (notification === 'All Cleared' ? 'win' : 'lose')
  const showHint = playing && nextIdx < points.length

  return (
    <div className="app">
      <header>
        <div className="info-row">
          <p id="notification" className={notificationClass}>{notification}</p>
        </div>
        <div className="controls-row">
          <div className="control-group">
            <label>Points:</label>
            <input 
              type="number" 
              value={pointCount} 
              onChange={(e) => setPointCount(Math.max(1, Math.min(2000, parseInt(e.target.value) || 5)))}
              onFocus={(e) => e.target.select()}
              min="1" 
              max="2000"
              disabled={playing}
            />
          </div>
          <div className="control-group">
            <label>Time:</label>
            <input type="text" readOnly value={elapsed.toFixed(2) + 's'} />
          </div>
          <button onClick={handleStart}>{playing ? 'Restart' : 'Start'}</button>
          {playing && (
            <button onClick={handleAutoPlayToggle} id="autoPlayButton">
              {autoPlay ? 'Auto Play OFF' : 'Auto Play ON'}
            </button>
          )}
        </div>
      </header>
      <main>
        <div className="game-container">
          <canvas ref={canvasRef} id="gameCanvas" width="400" height="400" onClick={handleCanvasClick} />
          {showHint && <p id="hint">{hint}</p>}
        </div>
      </main>
    </div>
  )
}

export default App
