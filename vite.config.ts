import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],
  // These are server-only packages imported by *.server.ts files
  // (nodemailer / telbiz / web-push send SMS, email and push from
  // Remix loaders/actions). Vite's dep-pre-bundle scans them anyway
  // and chokes because they import Node built-ins like `https`. Telling
  // optimizeDeps to skip them resolves the dev-server startup error —
  // they stay external for SSR (which is correct) and never reach the
  // client bundle (Remix already strips them via the `.server` suffix).
  optimizeDeps: {
    exclude: ["nodemailer", "telbiz", "web-push", "agent-base"],
  },
  ssr: {
    // Keep the same packages external on the SSR side too, so Vite
    // doesn't try to compile them for the server bundle either.
    noExternal: [],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
