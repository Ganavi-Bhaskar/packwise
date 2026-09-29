import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

beforeAll(() => {
	vi.stubGlobal('IntersectionObserver', class {
		constructor(callback) {
			this.callback = callback
		}

		observe(target) {
			this.callback([{ isIntersecting: true, target }], this)
		}

		unobserve() {}
		disconnect() {}
	})
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback) {
			this.callback = callback
		}

		observe(target) {
			this.callback([{ contentRect: { width: 640, height: 280 }, target }], this)
		}

		unobserve() {}
		disconnect() {}
	})
})

afterEach(() => {
	cleanup()
	window.localStorage.clear()
	document.documentElement.dataset.theme = 'light'
})
