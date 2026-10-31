import { Injectable } from '@nestjs/common';
import {
  ASSESSMENT_PROMPT,
  AI_REQUEST_TIMEOUT_MS,
  type AssessmentInput,
  type Evaluation,
  parseEvaluation,
} from '../common/assessment';

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { code?: number; status?: string; message?: string };
};

@Injectable()
export class GeminiAssessmentProvider {
  async evaluate(input: AssessmentInput): Promise<Evaluation> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: ASSESSMENT_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: JSON.stringify({
                    claim: input.claimText,
                    product: input.productName,
                    population: input.population ?? 'not specified',
                    evidence: input.evidence,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                verdict: {
                  type: 'STRING',
                  enum: ['JUSTIFIED', 'NOT_JUSTIFIED', 'INCONCLUSIVE'],
                },
                confidence: { type: 'NUMBER' },
                reasoning: { type: 'STRING' },
                limitations: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['verdict', 'confidence', 'reasoning', 'limitations'],
            },
          },
        }),
      },
    );

    let result: GeminiResponse;
    try {
      result = (await response.json()) as GeminiResponse;
    } catch {
      const error = new Error(
        response.ok ? 'Gemini returned an unreadable response.' : 'Gemini request failed.',
      );
      if (!response.ok) Object.assign(error, { status: response.status });
      throw error;
    }
    if (!response.ok) {
      const error = new Error(result.error?.message ?? 'Gemini request failed.');
      Object.assign(error, {
        status: response.status,
        code: result.error?.status ?? result.error?.code,
      });
      throw error;
    }

    const responseText = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    if (!responseText) {
      throw new Error('Gemini returned no assessment.');
    }

    return parseEvaluation(responseText, 'Gemini');
  }
}
