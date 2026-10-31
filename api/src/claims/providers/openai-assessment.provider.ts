import { Injectable } from '@nestjs/common';
import {
  ASSESSMENT_PROMPT,
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY?.trim()}`,
        'Content-Type': 'application/json',
      },
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

    const result = (await response.json()) as OpenAIResponse;
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
