import { OPENPRODUCT } from "@/lib/links";

const STEPS = [
  { n: "01", title: "Keep the repo public", body: "Your code and workspace are the listing. No pitch deck, no form to keep updated." },
  { n: "02", title: "Your app map draws itself", body: "Data, sign-in, payments and deploy come from the integrations you actually use." },
  { n: "03", title: "Anyone can fork and run it", body: "One click puts a copy on their own cloud, and the fork links back to you." },
];

export function HowItWorks() {
  return (
    <section className="band" aria-labelledby="how">
      <div className="band-top">
        <div>
          <div className="kicker">HOW A BUILD GETS HERE</div>
          <h2 id="how">Ship on Orunbase, and your listing keeps itself up to date.</h2>
        </div>
        <a className="btn" style={{ background: "#fff", color: "var(--ink)" }} href={OPENPRODUCT}>
          List your build, free
        </a>
      </div>
      <div className="steps">
        {STEPS.map((s) => (
          <div className="step" key={s.n}>
            <div className="n">{s.n}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
