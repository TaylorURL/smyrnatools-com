import { useEffect, useRef, useState } from 'react'

const MIN_CANVAS_DIMENSION_PX = 420
const DEFAULT_CANVAS_HEIGHT_PX = 600
const DEFAULT_CANVAS_WIDTH_PX = 800

const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.15
const DEFAULT_ZOOM = 0.6

/**
 * Manages the flow canvas: ResizeObserver-driven `canvasSize`, a
 * `zoom` value with helpers (`zoomIn`/`zoomOut`/`zoomReset`), and
 * click-and-drag panning that hijacks mousedown on the background only —
 * clicks on buttons / inputs / interactive elements pass through.
 *
 * Returns a ref to attach to the scrollable container plus event/state
 * the caller can wire into the JSX.
 */
export function usePlanFlowCanvas({ pickingDestination = false } = {}) {
    const canvasRef = useRef(null)
    const panStateRef = useRef(null)
    const [canvasSize, setCanvasSize] = useState({
        height: DEFAULT_CANVAS_HEIGHT_PX,
        width: DEFAULT_CANVAS_WIDTH_PX
    })
    const [zoom, setZoom] = useState(DEFAULT_ZOOM)
    const [isPanning, setIsPanning] = useState(false)

    useEffect(() => {
        const node = canvasRef.current
        if (!node) return undefined
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                setCanvasSize({
                    height: Math.max(MIN_CANVAS_DIMENSION_PX, height),
                    width: Math.max(MIN_CANVAS_DIMENSION_PX, width)
                })
            }
        })
        resizeObserver.observe(node)
        return () => resizeObserver.disconnect()
    }, [])

    const beginPan = (event) => {
        if (pickingDestination) return
        if (event.button !== 0) return
        const target = event.target
        if (target && target.closest && target.closest('button, a, input, select, textarea')) return
        const container = canvasRef.current
        if (!container) return
        panStateRef.current = {
            startScrollLeft: container.scrollLeft,
            startScrollTop: container.scrollTop,
            startX: event.clientX,
            startY: event.clientY
        }
        setIsPanning(true)
        event.preventDefault()
    }

    useEffect(() => {
        if (!isPanning) return undefined
        const container = canvasRef.current
        if (!container) return undefined
        const handleMouseMove = (event) => {
            const state = panStateRef.current
            if (!state) return
            const dx = event.clientX - state.startX
            const dy = event.clientY - state.startY
            container.scrollLeft = state.startScrollLeft - dx
            container.scrollTop = state.startScrollTop - dy
        }
        const handlePanEnd = () => {
            panStateRef.current = null
            setIsPanning(false)
        }
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handlePanEnd)
        window.addEventListener('mouseleave', handlePanEnd)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handlePanEnd)
            window.removeEventListener('mouseleave', handlePanEnd)
        }
    }, [isPanning])

    const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))
    const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100))
    const zoomReset = () => setZoom(DEFAULT_ZOOM)

    return {
        beginPan,
        canvasRef,
        canvasSize,
        isPanning,
        zoom,
        zoomIn,
        zoomLimits: { max: MAX_ZOOM, min: MIN_ZOOM },
        zoomOut,
        zoomReset
    }
}
