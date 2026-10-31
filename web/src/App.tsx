import { useState, type FormEvent } from 'react';
import AssessmentPanel from './components/AssessmentPanel';
import ClaimForm from './components/ClaimForm';
import PageFooter from './components/PageFooter';
import PageHeader from './components/PageHeader';
import SavedClaims from './components/SavedClaims';
import { sampleClaim } from './data/sampleClaim';
import type {
  AssessmentResponse,
  ClaimFormValues,
} from './types/assessment';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export default function App() {
  const [formValues, setFormValues] = useState(sampleClaim);
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  function handleChange(field: keyof ClaimFormValues, value: string) {
    setFormValues((currentValues) => ({ ...currentValues, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });

      const responseText = await response.text();
      let data: Partial<AssessmentResponse> & { message?: string } = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText) as Partial<AssessmentResponse> & {
            message?: string;
          };
        } catch {
          throw new Error(
            `The API returned an unreadable response (HTTP ${response.status}). Check the API terminal for details.`,
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.message ??
            `The API request failed (HTTP ${response.status}). Check the API terminal for details.`,
        );
      }

      if (!data.claimId || !data.assessment) {
        throw new Error(
          `The API returned an empty or incomplete response (HTTP ${response.status}). Check the API terminal for details.`,
        );
      }

      setResult(data as AssessmentResponse);
      setListRefreshKey((currentKey) => currentKey + 1);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to reach the API.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <PageHeader />

      <div className="workspace">
        <ClaimForm
          values={formValues}
          loading={loading}
          error={error}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
        <AssessmentPanel result={result} />
      </div>

      <SavedClaims refreshKey={listRefreshKey} />

      <PageFooter />
    </main>
  );
}
