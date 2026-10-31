import {
  BadGatewayException,
  GatewayTimeoutException,
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
  isTimeoutError,
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
    let assessmentInput = dto;
    if (dto.claimId) {
      let existingClaim: Awaited<ReturnType<PrismaService['findClaimById']>>;
      try {
        existingClaim = await this.prisma.findClaimById(dto.claimId);
      } catch (error) {
        throw this.databaseUnavailable(error);
      }

      if (!existingClaim) {
        throw new NotFoundException('Claim not found');
      }

      assessmentInput = {
        ...dto,
        claimText: existingClaim.text,
        productName: existingClaim.productName,
        population: existingClaim.population ?? undefined,
      };
    }

    const provider = this.getProvider();
    let evaluation: Evaluation;

    if (provider === 'demo') {
      evaluation = this.demoEvaluate(assessmentInput);
    } else {
      try {
        evaluation =
          provider === 'openai'
            ? await this.openAI.evaluate(assessmentInput)
            : await this.gemini.evaluate(assessmentInput);
      } catch (error) {
        const providerName = provider === 'openai' ? 'OpenAI' : 'Gemini';
        const status = getErrorStatus(error);
        if (isTimeoutError(error) || status === '408' || status === '504') {
          this.logger.error(`${providerName} assessment timed out.`);
          throw new GatewayTimeoutException(
            `${providerName} assessment timed out. Please try again.`,
          );
        }

        const details = [getErrorStatus(error), getErrorCode(error)]
          .filter(Boolean)
          .join(', ');
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
        claimId: dto.claimId,
        claimText: assessmentInput.claimText,
        productName: assessmentInput.productName,
        population: assessmentInput.population,
        evidence: dto.evidence,
        ...evaluation,
        model: this.getModel(provider),
        isDemo: provider === 'demo',
      });
    } catch (error) {
      throw this.databaseUnavailable(error);
    }

    return {
      claimId: savedClaim.id,
      claim: savedClaim.text,
      productName: savedClaim.productName,
      assessment: savedClaim.assessment,
    };
  }

  async list() {
    let claims: Awaited<ReturnType<PrismaService['findAllClaims']>>;
    try {
      claims = await this.prisma.findAllClaims();
    } catch (error) {
      throw this.databaseUnavailable(error);
    }

    return {
      claims: claims.map(({ assessments, ...claim }) => ({
        ...claim,
        latestAssessment: assessments[0] ?? null,
      })),
    };
  }

  async history(claimId: string) {
    let claim: Awaited<ReturnType<PrismaService['findClaimHistory']>>;
    try {
      claim = await this.prisma.findClaimHistory(claimId);
    } catch (error) {
      throw this.databaseUnavailable(error);
    }

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

  private databaseUnavailable(error: unknown): ServiceUnavailableException {
    const code = getErrorCode(error);
    this.logger.error(
      `Database operation failed${code ? ` (${code})` : ''}.`,
    );
    return new ServiceUnavailableException(
      'The database operation failed. Check the API terminal for details.',
    );
  }
}
