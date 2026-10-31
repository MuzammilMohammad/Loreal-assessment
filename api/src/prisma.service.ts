import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type AssessmentVerdict = 'JUSTIFIED' | 'NOT_JUSTIFIED' | 'INCONCLUSIVE';

type AssessmentInput = {
  claimId?: string;
  claimText: string;
  productName: string;
  population?: string;
  evidence: string;
  verdict: AssessmentVerdict;
  confidence: number;
  reasoning: string;
  limitations: string[];
  model: string;
  isDemo: boolean;
};

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client = new PrismaClient();

  async onModuleInit() {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error('DATABASE_URL is required. Add it to api/.env before starting the API.');
    }

    await this.client.$connect();
    this.logger.log('Connected to PostgreSQL.');
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  async saveAssessment(input: AssessmentInput) {
    const assessmentData = {
      evidence: input.evidence,
      verdict: input.verdict,
      confidence: input.confidence,
      reasoning: input.reasoning,
      limitations: input.limitations,
      model: input.model,
      isDemo: input.isDemo,
    };

    if (input.claimId) {
      const assessment = await this.client.assessment.create({
        data: {
          ...assessmentData,
          claim: { connect: { id: input.claimId } },
        },
        include: { claim: true },
      });
      const { claim, ...savedAssessment } = assessment;
      return { ...claim, assessment: savedAssessment };
    }

    const claim = await this.client.claim.create({
      data: {
        text: input.claimText,
        productName: input.productName,
        population: input.population,
        assessments: {
          create: assessmentData,
        },
      },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const { assessments, ...savedClaim } = claim;
    return { ...savedClaim, assessment: assessments[0] };
  }

  async findClaimById(id: string) {
    return this.client.claim.findUnique({
      where: { id },
      select: {
        id: true,
        text: true,
        productName: true,
        population: true,
      },
    });
  }

  async findAllClaims() {
    return this.client.claim.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findClaimHistory(claimId: string) {
    return this.client.claim.findUnique({
      where: { id: claimId },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }
}
