import type { AssessmentResponse } from '../types/assessment';

type AssessmentPanelProps = {
  result: AssessmentResponse | null;
};

export default function AssessmentPanel({ result }: AssessmentPanelProps) {
  const assessment = result?.assessment;
  const confidence = assessment?.confidence ?? 0;

  return (
    <section className="result-card" aria-live="polite">
      <div className="section-title">
        <span>02</span>
        <h2>Assessment</h2>
      </div>

      {!result || !assessment ? (
        <div className="empty">
          <div className="empty-icon">↗</div>
          <h3>Ready when you are</h3>
          <p>Your verdict, confidence, reasoning, and limitations will appear here.</p>
        </div>
      ) : (
        <div className="result-content">
          <span className={`verdict ${assessment.verdict.toLowerCase()}`}>
            {assessment.verdict.replace('_', ' ')}
          </span>

          {assessment.isDemo && (
            <p className="demo-note">DEMO MODE · No model analysis was performed</p>
          )}

          <div className="confidence">
            <div>
              <span>Confidence</span>
              <b>{Math.round(confidence * 100)}%</b>
            </div>
            <div className="track">
              <i style={{ width: `${confidence * 100}%` }} />
            </div>
          </div>

          <div className="reason">
            <h3>Reasoning</h3>
            <p>{assessment.reasoning}</p>
          </div>

          {assessment.limitations.length > 0 && (
            <div className="reason">
              <h3>Limitations</h3>
              <ul>
                {assessment.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="model">
            Stored as claim <code>{result.claimId}</code> · {assessment.model}
          </p>
        </div>
      )}
    </section>
  );
}
