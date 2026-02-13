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
      svg.style.cursor = 'pointer'

      svg.addEventListener('click', () => {
        const overlay = document.createElement('div')
        overlay.className = 'mermaid-zoom-overlay'

        const container = document.createElement('div')
        container.className = 'mermaid-zoom-container'

        const clone = svg.cloneNode(true) as SVGElement
        clone.removeAttribute('data-zoom-attached')
        clone.style.maxWidth = '95vw'
        clone.style.maxHeight = '90vh'
        clone.style.width = 'auto'
        clone.style.height = 'auto'

        if (!clone.getAttribute('viewBox')) {
          const bbox = (svg as SVGSVGElement).getBBox?.()
          if (bbox) {
            clone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
          }
        }

        const controls = document.createElement('div')
        controls.className = 'mermaid-zoom-controls'
        controls.innerHTML = `
          <button class="zoom-close" title="Close (Esc)">✕</button>
        `

        container.appendChild(clone)
        overlay.appendChild(container)
        overlay.appendChild(controls)
        document.body.appendChild(overlay)

        requestAnimationFrame(() => overlay.classList.add('active'))

        const close = () => {
          overlay.classList.remove('active')
          setTimeout(() => overlay.remove(), 200)
        }

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) close()
        })
        controls.querySelector('.zoom-close')?.addEventListener('click', close)

        const handleKey = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            close()
            document.removeEventListener('keydown', handleKey)
          }
        }
        document.addEventListener('keydown', handleKey)
      })
    })
  }

  tryAttach()
}
