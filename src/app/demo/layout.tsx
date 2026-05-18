// v1 demo tree is retired; every page under /demo redirects to /v2/demo.
// This passthrough ensures the old demo layout cannot run auth/data
// logic before the page-level redirect fires.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
