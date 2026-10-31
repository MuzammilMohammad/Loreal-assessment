import { Injectable } from '@nestjs/common';
import {
  ASSESSMENT_PROMPT,
  AI_REQUEST_TIMEOUT_MS,
  type AssessmentInput,
  type Evaluation,
  parseEvaluation,
} from '../common/assessment';

type OpenAIResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string; code?: string };
};

@Injectable()
export class OpenAIAssessmentProvider {
  async evaluate(input: AssessmentInput): Promise<Evaluation> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ASSESSMENT_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              claim: input.claimText,
              product: input.productName,
              population: input.population ?? 'not specified',
              evidence: input.evidence,
            }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'claim_assessment',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                verdict: {
                  type: 'string',
                  enum: ['JUSTIFIED', 'NOT_JUSTIFIED', 'INCONCLUSIVE'],
                },
                confidence: { type: 'number' },
                reasoning: { type: 'string' },
                limitations: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['verdict', 'confidence', 'reasoning', 'limitations'],
            },
          },
        },
      }),
    });

    let result: OpenAIResponse;
    try {
      result = (await response.json()) as OpenAIResponse;
    } catch {
      const error = new Error(
        response.ok ? 'OpenAI returned an unreadable response.' : 'OpenAI request failed.',
      );
      if (!response.ok) Object.assign(error, { status: response.status });
      throw error;
    }
    if (!response.ok) {
      const error = new Error(result.error?.message ?? 'OpenAI request failed.');
      Object.assign(error, {
        status: response.status,
        code: result.error?.code,
      });
      throw error;
    }

    const responseText = result.choices?.[0]?.message?.content;
    if (!responseText) {
      throw new Error('OpenAI returned no assessment.');
    }

    return parseEvaluation(responseText, 'OpenAI');
  }
}
