import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AssessClaimDto } from './dto/assess-claim.dto';
import {
  getErrorCode,
  getErrorStatus,
  type AssessmentProviderName,
  type Evaluation,
} from './common/assessment';
import { GeminiAssessmentProvider } from './providers/gemini-assessment.provider';
import { OpenAIAssessmentProvider } from './providers/openai-assessment.provider';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAI: OpenAIAssessmentProvider,
    private readonly gemini: GeminiAssessmentProvider,
  ) {}

  async assess(dto: AssessClaimDto) {
    const provider = this.getProvider();
    let evaluation: Evaluation;

    if (provider === 'demo') {
      evaluation = this.demoEvaluate(dto);
    } else {
      try {
        evaluation =
          provider === 'openai'
            ? await this.openAI.evaluate(dto)
            : await this.gemini.evaluate(dto);
      } catch (error) {
        const details = [getErrorStatus(error), getErrorCode(error)]
          .filter(Boolean)
          .join(', ');
        const providerName = provider === 'openai' ? 'OpenAI' : 'Gemini';
        const message = details
          ? `${providerName} assessment failed (${details}). Check the API key, model access, and account quota or billing.`
          : `${providerName} assessment failed. Check the API terminal for details.`;

        this.logger.error(message);
        throw new BadGatewayException(message);
      }
    }

    let savedClaim: Awaited<ReturnType<PrismaService['saveAssessment']>>;
    try {
      savedClaim = await this.prisma.saveAssessment({
        claimText: dto.claimText,
        productName: dto.productName,
        population: dto.population,
        evidence: dto.evidence,
        ...evaluation,
        model: this.getModel(provider),
        isDemo: provider === 'demo',
      });
    } catch (error) {
      const code = getErrorCode(error);
      this.logger.error(
        `Could not save the assessment to the database${code ? ` (${code})` : ''}.`,
      );
      throw new ServiceUnavailableException(
        'The assessment could not be saved. Check the API terminal for the database error.',
      );
    }

    return {
      claimId: savedClaim.id,
      claim: savedClaim.text,
      productName: savedClaim.productName,
      assessment: savedClaim.assessment,
    };
  }

  async list() {
    const claims = await this.prisma.findAllClaims();

    return {
      claims: claims.map(({ assessments, ...claim }) => ({
        ...claim,
        latestAssessment: assessments[0] ?? null,
      })),
    };
  }

  async history(claimId: string) {
    const claim = await this.prisma.findClaimHistory(claimId);

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return claim;
  }

  private getProvider(): AssessmentProviderName {
    const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
    const provider = configuredProvider ||
      (process.env.OPENAI_API_KEY?.trim()
        ? 'openai'
        : process.env.GEMINI_API_KEY?.trim()
          ? 'gemini'
          : 'demo');

    if (provider !== 'openai' && provider !== 'gemini' && provider !== 'demo') {
      throw new ServiceUnavailableException(
        'AI_PROVIDER must be set to openai, gemini, or demo.',
      );
    }

    if (provider === 'openai' && !process.env.OPENAI_API_KEY?.trim()) {
      throw new ServiceUnavailableException(
        'AI_PROVIDER is openai, but OPENAI_API_KEY is missing from api/.env.',
      );
    }

    if (provider === 'gemini' && !process.env.GEMINI_API_KEY?.trim()) {
      throw new ServiceUnavailableException(
        'AI_PROVIDER is gemini, but GEMINI_API_KEY is missing from api/.env.',
      );
    }

    return provider;
  }

  private getModel(provider: AssessmentProviderName): string {
    if (provider === 'openai') {
      return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    }
    if (provider === 'gemini') {
      return process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
    }
    return 'local-demo';
  }

  private demoEvaluate(dto: AssessClaimDto): Evaluation {
    return {
      verdict: 'INCONCLUSIVE',
      confidence: 0.15,
      reasoning: `Demo mode is active. No scientific conclusion was produced for “${dto.claimText}”. Configure an OpenAI or Gemini API key to request evidence review.`,
      limitations: [
        'This is a local demonstration; no LLM analysis occurred.',
        'The supplied study evidence has not been scientifically evaluated.',
      ],
    };
  }
}
