import { useEffect, useState } from 'react';
import type {
  ClaimHistory,
  ClaimsListResponse,
  ClaimSummary,
} from '../types/assessment';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: T | { message?: string } = {} as T;

  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new Error(`The API returned an unreadable response (HTTP ${response.status}).`);
    }
  }

  if (!response.ok) {
    throw new Error(
      (data as { message?: string }).message ?? `The request failed (HTTP ${response.status}).`,
    );
  }

  return data as T;
}

type SavedClaimsProps = {
  refreshKey: number;
};

export default function SavedClaims({ refreshKey }: SavedClaimsProps) {
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, ClaimHistory>>({});
  const [historyError, setHistoryError] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadClaims() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`${API_BASE_URL}/api/claims`);
        const data = await readResponse<ClaimsListResponse>(response);
        if (!cancelled) {
          setClaims(data.claims);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load saved claims.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadClaims();
    return () => { cancelled = true; };
  }, [refreshKey]);

  async function toggleClaim(claimId: string) {
    if (expandedId === claimId) {
      setExpandedId(null);
      setHistoryError('');
      return;
    }

    setExpandedId(claimId);
    setHistoryError('');
    if (history[claimId]) return;

    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/${encodeURIComponent(claimId)}/assessments`);
      const data = await readResponse<ClaimHistory>(response);
      setHistory((current) => ({ ...current, [claimId]: data }));
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : 'Unable to load assessment details.');
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <section className="saved-claims" aria-labelledby="saved-claims-title">
      <div className="saved-claims-heading">
        <div>
          <span className="eyebrow">REVIEW HISTORY</span>
          <h2 id="saved-claims-title">Saved claims</h2>
        </div>
        <span className="saved-count">{claims.length} {claims.length === 1 ? 'claim' : 'claims'}</span>
      </div>

      {loading && <p className="saved-message">Loading saved claims…</p>}
      {!loading && error && <p className="error" role="alert">{error}</p>}
      {!loading && !error && claims.length === 0 && (
        <p className="saved-message">No saved claims yet. Submit the form above to create the first one.</p>
      )}

      {!loading && !error && claims.length > 0 && (
        <div className="saved-list">
          {claims.map((claim) => {
            const latest = claim.latestAssessment;
            const isExpanded = expandedId === claim.id;
            const details = history[claim.id];

            return (
              <article className="saved-claim" key={claim.id}>
                <button
                  className="saved-claim-toggle"
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => void toggleClaim(claim.id)}
                >
                  <span className="saved-claim-main">
                    <strong>{claim.productName}</strong>
                    <span>{claim.text}</span>
                  </span>
                  <span className="saved-claim-meta">
                    {latest && <span className={`verdict ${latest.verdict.toLowerCase()}`}>{latest.verdict.replace('_', ' ')}</span>}
                    <time dateTime={claim.createdAt}>{formatDate(claim.createdAt)}</time>
                    <span className="expand-icon" aria-hidden="true">{isExpanded ? '−' : '+'}</span>
                  </span>
                </button>

                {isExpanded && (
                  <div className="saved-claim-details">
                    {loadingHistory && !details && <p className="saved-message">Loading assessment details…</p>}
                    {historyError && <p className="error" role="alert">{historyError}</p>}
                    {details?.population && <p><strong>Target population</strong><br />{details.population}</p>}
                    {details?.assessments.map((assessment) => (
                      <section className="saved-assessment" key={assessment.id}>
                        <div className="saved-assessment-heading">
                          <span className={`verdict ${assessment.verdict.toLowerCase()}`}>{assessment.verdict.replace('_', ' ')}</span>
                          <time dateTime={assessment.createdAt}>{formatDate(assessment.createdAt)}</time>
                        </div>
                        <p><strong>Evidence summary</strong><br />{assessment.evidence}</p>
                        <p><strong>Confidence</strong><br />{Math.round(assessment.confidence * 100)}%</p>
                        <p><strong>Reasoning</strong><br />{assessment.reasoning}</p>
                        {assessment.limitations.length > 0 && (
                          <div><strong>Limitations</strong><ul>{assessment.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
                        )}
                        <p className="model">Model: {assessment.model} · {assessment.isDemo ? 'Demo result' : 'Model assessment'}</p>
                      </section>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
