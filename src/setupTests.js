import '@testing-library/jest-dom'

import { vi } from 'vitest'

// The suites call the Jest globals (`jest.fn()`, `jest.mock()`,
// `jest.doMock()`, `jest.clearAllMocks()`). Vitest's `vi` exposes the same
// surface, so aliasing it as `jest` lets those call sites run under Vitest.
global.jest = vi

// jsdom does not implement ResizeObserver, and components that measure
// themselves construct one on mount.
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
