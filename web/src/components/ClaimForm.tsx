import type { FormEvent } from 'react';
import type { ClaimFormValues } from '../types/assessment';

type ClaimFormProps = {
  values: ClaimFormValues;
  loading: boolean;
  error: string;
  onChange: (field: keyof ClaimFormValues, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function ClaimForm({
  values,
  loading,
  error,
  onChange,
  onSubmit,
}: ClaimFormProps) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <div className="section-title">
        <span>01</span>
        <h2>Claim &amp; evidence</h2>
      </div>

      <label>
        Product name
        <input
          required
          maxLength={200}
          value={values.productName}
          onChange={(event) => onChange('productName', event.target.value)}
        />
      </label>

      <label>
        Proposed claim
        <textarea
          required
          minLength={8}
          maxLength={1000}
          rows={2}
          value={values.claimText}
          onChange={(event) => onChange('claimText', event.target.value)}
        />
      </label>

      <label>
        Target population <span className="optional">OPTIONAL</span>
        <input
          maxLength={500}
          value={values.population}
          onChange={(event) => onChange('population', event.target.value)}
        />
      </label>

      <label>
        Study evidence summary
        <textarea
          required
          minLength={30}
          maxLength={30000}
          rows={7}
          value={values.evidence}
          onChange={(event) => onChange('evidence', event.target.value)}
        />
      </label>

      <p className="privacy-note">
        Paste a de-identified summary. Do not enter personal or
        patient-identifiable information.
      </p>

      <button type="submit" disabled={loading}>
        {loading ? 'Reviewing evidence…' : 'Assess this claim'}
        <span>↗</span>
      </button>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
