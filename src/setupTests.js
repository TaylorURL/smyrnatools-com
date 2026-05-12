import '@testing-library/jest-dom'

// Polyfill APIs missing from jsdom
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
