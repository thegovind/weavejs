import DefaultTheme from 'vitepress/theme'
import './custom.css'
import mediumZoom from 'medium-zoom'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()

    const initZoom = () => {
      mediumZoom('.main img', { background: 'var(--vp-c-bg)' })
    }

    onMounted(() => {
      initZoom()
      initMermaidZoom()
    })

    watch(
      () => route.path,
      () => nextTick(() => {
        initZoom()
        initMermaidZoom()
      })
    )
  },
}

function initMermaidZoom() {
  let retries = 0
  const maxRetries = 20
  const interval = 500

  const tryAttach = () => {
    const svgs = document.querySelectorAll('.mermaid svg')
    if (svgs.length === 0 && retries < maxRetries) {
      retries++
      setTimeout(tryAttach, interval)
      return
    }

    svgs.forEach((svg) => {
      if (svg.getAttribute('data-zoom-attached')) return
      svg.setAttribute('data-zoom-attached', 'true')
      svg.style.cursor = 'zoom-in'

      svg.addEventListener('click', (e) => {
        e.stopPropagation()
        openMermaidViewer(svg as SVGSVGElement)
      })
    })
  }

  tryAttach()
}

function openMermaidViewer(svg: SVGSVGElement) {
  let scale = 1
  let panX = 0
  let panY = 0
  let isPanning = false
  let startX = 0
  let startY = 0
  const MIN_SCALE = 0.25
  const MAX_SCALE = 5
  const ZOOM_STEP = 0.25

  // Build overlay
  const overlay = document.createElement('div')
  overlay.className = 'mermaid-zoom-overlay'

  const viewport = document.createElement('div')
  viewport.className = 'mermaid-zoom-viewport'

  const wrapper = document.createElement('div')
  wrapper.className = 'mermaid-zoom-wrapper'

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('data-zoom-attached')
  clone.style.cursor = 'grab'
  clone.style.width = '100%'
  clone.style.height = '100%'
  clone.style.maxWidth = 'none'
  clone.style.maxHeight = 'none'

  // Ensure viewBox is set for proper scaling
  if (!clone.getAttribute('viewBox')) {
    const bbox = svg.getBBox?.()
    if (bbox) {
      clone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
    }
  }
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  // Controls
  const controls = document.createElement('div')
  controls.className = 'mermaid-zoom-controls'
  controls.innerHTML = `
    <button class="zoom-btn" data-action="zoom-in" title="Zoom in (+)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    </button>
    <span class="zoom-level">100%</span>
    <button class="zoom-btn" data-action="zoom-out" title="Zoom out (-)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    </button>
    <button class="zoom-btn" data-action="zoom-fit" title="Fit to screen (0)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
    </button>
    <button class="zoom-btn" data-action="zoom-reset" title="Reset zoom (1)">1:1</button>
    <div class="zoom-divider"></div>
    <button class="zoom-btn zoom-close" data-action="close" title="Close (Esc)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `

  const hint = document.createElement('div')
  hint.className = 'mermaid-zoom-hint'
  hint.textContent = 'Scroll to zoom · Drag to pan · Esc to close'

  wrapper.appendChild(clone)
  viewport.appendChild(wrapper)
  overlay.appendChild(viewport)
  overlay.appendChild(controls)
  overlay.appendChild(hint)
  document.body.appendChild(overlay)

  // Fade in
  requestAnimationFrame(() => overlay.classList.add('active'))

  // Fade out hint after 3s
  setTimeout(() => hint.classList.add('fade-out'), 3000)

  const zoomLabel = controls.querySelector('.zoom-level') as HTMLElement
  const updateTransform = () => {
    wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`
    zoomLabel.textContent = `${Math.round(scale * 100)}%`
  }

  const zoomTo = (newScale: number, cx?: number, cy?: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale))
    if (cx !== undefined && cy !== undefined) {
      const rect = viewport.getBoundingClientRect()
      const dx = cx - rect.left - rect.width / 2
      const dy = cy - rect.top - rect.height / 2
      panX -= dx * (clamped / scale - 1)
      panY -= dy * (clamped / scale - 1)
    }
    scale = clamped
    updateTransform()
  }

  const fitToScreen = () => {
    scale = 1
    panX = 0
    panY = 0
    updateTransform()
  }

  const resetZoom = () => {
    // Set scale so SVG renders at its natural pixel size
    const svgW = parseFloat(clone.getAttribute('width') || '0')
    const svgH = parseFloat(clone.getAttribute('height') || '0')
    const rect = viewport.getBoundingClientRect()
    if (svgW && svgH && rect.width && rect.height) {
      scale = Math.min(svgW / rect.width, svgH / rect.height, MAX_SCALE)
      if (scale < MIN_SCALE) scale = 1
    } else {
      scale = 1
    }
    panX = 0
    panY = 0
    updateTransform()
  }

  const close = () => {
    overlay.classList.remove('active')
    setTimeout(() => overlay.remove(), 200)
    document.removeEventListener('keydown', handleKey)
  }

  // Wheel zoom (centered on cursor)
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    zoomTo(scale + delta * scale * 0.5, e.clientX, e.clientY)
  }, { passive: false })

  // Pan with mouse drag
  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    isPanning = true
    startX = e.clientX - panX
    startY = e.clientY - panY
    clone.style.cursor = 'grabbing'
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return
    panX = e.clientX - startX
    panY = e.clientY - startY
    updateTransform()
  })

  document.addEventListener('mouseup', () => {
    isPanning = false
    clone.style.cursor = 'grab'
  })

  // Touch pan & pinch zoom
  let lastTouchDist = 0
  let lastTouchX = 0
  let lastTouchY = 0

  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isPanning = true
      lastTouchX = e.touches[0].clientX
      lastTouchY = e.touches[0].clientY
    } else if (e.touches.length === 2) {
      isPanning = false
      lastTouchDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      )
    }
    e.preventDefault()
  }, { passive: false })

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isPanning) {
      panX += e.touches[0].clientX - lastTouchX
      panY += e.touches[0].clientY - lastTouchY
      lastTouchX = e.touches[0].clientX
      lastTouchY = e.touches[0].clientY
      updateTransform()
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      )
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      zoomTo(scale * (dist / lastTouchDist), cx, cy)
      lastTouchDist = dist
    }
    e.preventDefault()
  }, { passive: false })

  viewport.addEventListener('touchend', () => { isPanning = false })

  // Button controls
  controls.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement
    if (!btn) return
    e.stopPropagation()
    switch (btn.dataset.action) {
      case 'zoom-in': zoomTo(scale + ZOOM_STEP); break
      case 'zoom-out': zoomTo(scale - ZOOM_STEP); break
      case 'zoom-fit': fitToScreen(); break
      case 'zoom-reset': resetZoom(); break
      case 'close': close(); break
    }
  })

  // Keyboard shortcuts
  const handleKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape': close(); break
      case '+': case '=': zoomTo(scale + ZOOM_STEP); e.preventDefault(); break
      case '-': case '_': zoomTo(scale - ZOOM_STEP); e.preventDefault(); break
      case '0': fitToScreen(); e.preventDefault(); break
      case '1': resetZoom(); e.preventDefault(); break
    }
  }
  document.addEventListener('keydown', handleKey)

  // Close on overlay background click (not on the SVG)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === viewport) close()
  })
}
