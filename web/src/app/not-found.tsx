import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap section">
        <h1 style={{ letterSpacing: "-0.02em" }}>Nothing here.</h1>
        <p className="muted">No build goes by that name. <a className="link" href="/">Back to the builds</a></p>
      </main>
      <SiteFooter />
    </>
  );
}
