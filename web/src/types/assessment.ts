export type Verdict = 'JUSTIFIED' | 'NOT_JUSTIFIED' | 'INCONCLUSIVE';

export type Assessment = {
  id: string;
  claimId: string;
  evidence: string;
  createdAt: string;
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  limitations: string[];
  isDemo: boolean;
  model: string;
};

export type AssessmentResponse = {
  claimId: string;
  claim: string;
  productName: string;
  assessment: Assessment;
};

export type ClaimFormValues = {
  claimText: string;
  productName: string;
  population: string;
  evidence: string;
};

export type ClaimSummary = {
  id: string;
  text: string;
  productName: string;
  population: string | null;
  createdAt: string;
  latestAssessment: Assessment | null;
};

export type ClaimHistory = Omit<ClaimSummary, 'latestAssessment'> & {
  assessments: Assessment[];
};

export type ClaimsListResponse = {
  claims: ClaimSummary[];
};
