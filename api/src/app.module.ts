import { Module } from '@nestjs/common';
import { ClaimsController } from './claims/claims.controller';
import { ClaimsService } from './claims/claims.service';
import { GeminiAssessmentProvider } from './claims/providers/gemini-assessment.provider';
import { OpenAIAssessmentProvider } from './claims/providers/openai-assessment.provider';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [ClaimsController],
  providers: [
    ClaimsService,
    PrismaService,
    OpenAIAssessmentProvider,
    GeminiAssessmentProvider,
  ],
})
export class AppModule {}
