import type { Metric } from 'web-vitals'

type PerfEntryCallback = (metric: Metric) => void

/** Lazily reports Core Web Vitals (CLS, FID, FCP, LCP, TTFB) via a provided callback. */
const vitalsUtility = (onPerfEntry: PerfEntryCallback) => {
    if (onPerfEntry && onPerfEntry instanceof Function) {
        // Reaching the library is the same optional fetch as reaching this
        // module, and it fails the same way for the same reason: a deploy has
        // replaced the chunk the document names. There is nothing to measure
        // with and nobody waiting to be told, so the rejection ends here rather
        // than travelling on as a fault.
        import('web-vitals').then(
            ({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
                getCLS(onPerfEntry)
                getFID(onPerfEntry)
                getFCP(onPerfEntry)
                getLCP(onPerfEntry)
                getTTFB(onPerfEntry)
            },
            () => {}
        )
    }
}
export default vitalsUtility
