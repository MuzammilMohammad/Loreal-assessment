import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { AssessClaimDto } from './dto/assess-claim.dto';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post('assess')
  assess(@Body() dto: AssessClaimDto) {
    return this.claimsService.assess(dto);
  }

  @Get()
  list() {
    return this.claimsService.list();
  }

  @Get(':id/assessments')
  history(@Param('id') id: string) {
    return this.claimsService.history(id);
  }
}
