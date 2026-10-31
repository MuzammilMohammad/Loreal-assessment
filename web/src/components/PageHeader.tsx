export default function PageHeader() {
  return (
    <>
      <header>
        <div className="brand">
          <span className="brand-mark">CI</span>
          <span>
            R&amp;I <b>Claims Intelligence</b>
          </span>
        </div>
        <span className="tag">EVIDENCE REVIEW · PROTOTYPE</span>
      </header>

      <section className="intro">
        <p className="eyebrow">PRODUCT CLAIMS / SCIENTIFIC REVIEW</p>
        <h1>
          Does the evidence
          <br />
          <em>hold up?</em>
        </h1>
        <p className="lede">
          Submit a cosmetic claim and study summary. The reviewer checks whether
          the evidence supports the claim’s exact wording, timeframe, and
          population.
        </p>
      </section>
    </>
  );
}
