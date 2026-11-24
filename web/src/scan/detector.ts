// The barcode library and its wasm load on first use, so they stay out of the first page load. The
// wasm is part of the build (and the service worker's precache) instead of coming from a CDN.
export interface Detector {
  detect(source: HTMLVideoElement): Promise<string[]>
}

let cached: Promise<Detector> | undefined

async function create(): Promise<Detector> {
  const [{ BarcodeDetector, setZXingModuleOverrides }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) })
  const detector = new BarcodeDetector({ formats: ['qr_code', 'data_matrix', 'code_128', 'ean_13', 'ean_8'] })
  return { detect: async (source) => (await detector.detect(source)).map((r) => r.rawValue) }
}

export function loadDetector(): Promise<Detector> {
  cached ??= create().catch((err) => {
    cached = undefined
    throw err
  })
  return cached
}
