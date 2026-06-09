declare module 'webspice' {
  export default class WebspiceShell {
    static instantiate(
      includes: unknown[],
      options?: { basePath?: string },
    ): Promise<WebspiceShell>

    furnsh(
      input: string,
      onProgress?: (progress: {
        contentLength: number
        receivedLength: number
        done: boolean
      }) => void,
    ): Promise<void>

    spkez(
      target: number,
      ephemerisTime: number,
      referenceFrame: string,
      aberrationCorrection: string,
      observer: number,
    ): [[number, number, number, number, number, number], number]

    str2et(time: string): number
  }
}

declare module 'webspice/dist/include/methods/furnsh.js' {
  const furnsh: unknown
  export default furnsh
}

declare module 'webspice/dist/include/methods/spkez.js' {
  const spkez: unknown
  export default spkez
}

declare module 'webspice/dist/include/methods/str2et.js' {
  const str2et: unknown
  export default str2et
}
