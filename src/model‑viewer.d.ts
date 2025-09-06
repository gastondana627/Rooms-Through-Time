/* src/model-viewer.d.ts */
declare global {
    namespace JSX {
      interface IntrinsicElements {
        /**
         * Web‑Component that renders GLTF/GLB models.
         * We keep the type very permissive – you only need the attributes you use
         * (src, alt, camera‑controls, auto‑rotate, style, onError, …).
         */
        'model-viewer': React.DetailedHTMLProps<
          React.HTMLAttributes<HTMLElement>,
          HTMLElement
        >;
      }
    }
  }