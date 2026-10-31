const assert = require('node:assert/strict');
const { test } = require('node:test');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const {
  BadGatewayException,
  GatewayTimeoutException,
  Module,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { ClaimsController } = require('../dist/claims/claims.controller');
const { ClaimsService } = require('../dist/claims/claims.service');
const { AssessClaimDto } = require('../dist/claims/dto/assess-claim.dto');
const { OpenAIAssessmentProvider } = require('../dist/claims/providers/openai-assessment.provider');
const { GeminiAssessmentProvider } = require('../dist/claims/providers/gemini-assessment.provider');

const validRequest = {
  claimText: 'Reduces wrinkles by 20% in four weeks',
  productName: 'Sample serum',
  population: 'Adults aged 40–65',
  evidence: 'A randomized controlled study compared the product with a vehicle control.',
};

function createPrisma(overrides = {}) {
  return {
    findClaimById: async (id) => ({
      id,
      text: validRequest.claimText,
      productName: validRequest.productName,
      population: validRequest.population,
    }),
    saveAssessment: async (input) => {
      const id = input.claimId ?? 'new-claim';
      return {
        id,
        text: input.claimText,
        productName: input.productName,
        assessment: {
          id: `assessment-${id}`,
          claimId: id,
          verdict: input.verdict,
          confidence: input.confidence,
          reasoning: input.reasoning,
          limitations: input.limitations,
          model: input.model,
          isDemo: input.isDemo,
        },
      };
    },
    findAllClaims: async () => [],
    findClaimHistory: async () => null,
    ...overrides,
  };
}

function withProvider(provider, run) {
  const previousProvider = process.env.AI_PROVIDER;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  process.env.AI_PROVIDER = provider;

  if (provider === 'openai') process.env.OPENAI_API_KEY = 'test-key';
  else delete process.env.OPENAI_API_KEY;
  if (provider === 'gemini') process.env.GEMINI_API_KEY = 'test-key';
  else delete process.env.GEMINI_API_KEY;

  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (previousProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = previousProvider;
      if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAIKey;
      if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGeminiKey;
    });
}

async function withHttpApi(service, run) {
  class ClaimsHttpTestModule {}
  Module({
    controllers: [ClaimsController],
    providers: [{ provide: ClaimsService, useValue: service }],
  })(ClaimsHttpTestModule);

  const app = await NestFactory.create(ClaimsHttpTestModule, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await app.close();
  }
}

async function postAssessment(baseUrl, body) {
  return fetch(`${baseUrl}/api/claims/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('rejects missing fields and undeclared request properties', async () => {
  const dto = plainToInstance(AssessClaimDto, {
    productName: validRequest.productName,
    unexpected: true,
  });

  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  assert.ok(errors.some((error) => error.property === 'claimText'));
  assert.ok(errors.some((error) => error.property === 'evidence'));
  assert.ok(errors.some((error) => error.property === 'unexpected'));
});

test('validates reassessment requests with only a claim ID and evidence', async () => {
  const dto = plainToInstance(AssessClaimDto, {
    claimId: 'claim-123',
    evidence: validRequest.evidence,
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  assert.deepEqual(errors, []);
});

test('creates a claim and returns its saved assessment', async () => {
  await withProvider('demo', async () => {
    const prisma = createPrisma();
    const service = new ClaimsService(prisma, {}, {});
    const result = await service.assess(validRequest);

    assert.equal(result.claimId, 'new-claim');
    assert.equal(result.assessment.isDemo, true);
    assert.equal(result.assessment.model, 'local-demo');
  });
});

test('adds a new assessment to the requested existing claim', async () => {
  await withProvider('demo', async () => {
    const savedInputs = [];
    const prisma = createPrisma({
      saveAssessment: async (input) => {
        savedInputs.push(input);
        return {
          id: input.claimId,
          text: validRequest.claimText,
          productName: validRequest.productName,
          assessment: { id: `assessment-${savedInputs.length}`, claimId: input.claimId },
        };
      },
    });
    const service = new ClaimsService(prisma, {}, {});

    await service.assess({ ...validRequest, claimId: 'claim-123' });

    assert.equal(savedInputs[0].claimId, 'claim-123');
    assert.equal(savedInputs.length, 1);
  });
});

test('uses the saved claim wording when an existing claim ID is supplied', async () => {
  await withProvider('openai', async () => {
    let modelInput;
    const prisma = createPrisma({
      findClaimById: async (id) => ({
        id,
        text: 'Saved claim wording',
        productName: 'Saved product',
        population: 'Saved population',
      }),
    });
    const service = new ClaimsService(
      prisma,
      {
        evaluate: async (input) => {
          modelInput = input;
          return {
            verdict: 'INCONCLUSIVE',
            confidence: 0.2,
            reasoning: 'Not enough information.',
            limitations: ['A limitation.'],
          };
        },
      },
      {},
    );

    await service.assess({
      ...validRequest,
      claimId: 'claim-123',
      claimText: 'Different request text',
      productName: 'Different request product',
    });

    assert.equal(modelInput.claimText, 'Saved claim wording');
    assert.equal(modelInput.productName, 'Saved product');
    assert.equal(modelInput.population, 'Saved population');
  });
});

test('returns 404 for an unknown claim before calling the model', async () => {
  await withProvider('openai', async () => {
    let providerCalled = false;
    const prisma = createPrisma({ findClaimById: async () => null });
    const service = new ClaimsService(
      prisma,
      { evaluate: async () => { providerCalled = true; } },
      {},
    );

    await assert.rejects(
      service.assess({ ...validRequest, claimId: 'missing-claim' }),
      NotFoundException,
    );
    assert.equal(providerCalled, false);
  });
});

test('returns a gateway error when a configured provider fails', async () => {
  await withProvider('openai', async () => {
    let saveCalled = false;
    const prisma = createPrisma({ saveAssessment: async () => { saveCalled = true; } });
    const service = new ClaimsService(
      prisma,
      { evaluate: async () => { throw new Error('provider unavailable'); } },
      {},
    );

    await assert.rejects(service.assess(validRequest), BadGatewayException);
    assert.equal(saveCalled, false);
  });
});

test('returns a timeout response when the provider exceeds its time limit', async () => {
  await withProvider('openai', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const service = new ClaimsService(
      createPrisma(),
      { evaluate: async () => { throw timeout; } },
      {},
    );

    await assert.rejects(service.assess(validRequest), GatewayTimeoutException);
  });
});

test('rejects incomplete or invalid model output before saving it', async () => {
  await withProvider('openai', async () => {
    const originalFetch = global.fetch;
    let saveCalled = false;
    global.fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        verdict: 'JUSTIFIED', confidence: 1, reasoning: '', limitations: [],
      }) } }],
    }), { status: 200 });
    const service = new ClaimsService(
      createPrisma({ saveAssessment: async () => { saveCalled = true; } }),
      new OpenAIAssessmentProvider(),
      {},
    );

    try {
      await assert.rejects(service.assess(validRequest), BadGatewayException);
      assert.equal(saveCalled, false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('rejects malformed model JSON before saving it', async () => {
  await withProvider('openai', async () => {
    const originalFetch = global.fetch;
    let saveCalled = false;
    global.fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{not valid json' } }],
    }), { status: 200 });
    const service = new ClaimsService(
      createPrisma({ saveAssessment: async () => { saveCalled = true; } }),
      new OpenAIAssessmentProvider(),
      {},
    );

    try {
      await assert.rejects(service.assess(validRequest), BadGatewayException);
      assert.equal(saveCalled, false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('accepts a valid structured response from the Gemini provider', async () => {
  await withProvider('gemini', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (_url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          verdict: 'INCONCLUSIVE',
          confidence: 0.4,
          reasoning: 'The summary does not report enough information.',
          limitations: ['The sample size is not provided.'],
        }) }] } }],
      }), { status: 200 });
    };
    const service = new ClaimsService(
      createPrisma(),
      {},
      new GeminiAssessmentProvider(),
    );

    try {
      const result = await service.assess(validRequest);
      assert.equal(result.assessment.verdict, 'INCONCLUSIVE');
      assert.equal(result.assessment.model, 'gemini-3.5-flash-lite');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('returns a safe service error when the database write fails', async () => {
  await withProvider('demo', async () => {
    const service = new ClaimsService(
      createPrisma({ saveAssessment: async () => { throw new Error('connection details'); } }),
      {},
      {},
    );

    await assert.rejects(service.assess(validRequest), ServiceUnavailableException);
  });
});

test('keeps successive assessments attached to the same claim', async () => {
  await withProvider('demo', async () => {
    const savedInputs = [];
    const prisma = createPrisma({
      saveAssessment: async (input) => {
        savedInputs.push(input);
        return {
          id: input.claimId,
          text: input.claimText,
          productName: input.productName,
          assessment: { id: `assessment-${savedInputs.length}`, claimId: input.claimId },
        };
      },
    });
    const service = new ClaimsService(prisma, {}, {});

    await service.assess({ ...validRequest, claimId: 'claim-123' });
    await service.assess({ ...validRequest, claimId: 'claim-123', evidence: `${validRequest.evidence} Follow-up result.` });

    assert.equal(savedInputs.length, 2);
    assert.deepEqual(savedInputs.map((input) => input.claimId), ['claim-123', 'claim-123']);
  });
});

test('returns 404 when assessment history is requested for an unknown claim', async () => {
  const service = new ClaimsService(createPrisma(), {}, {});
  await assert.rejects(service.history('missing-claim'), NotFoundException);
});

test('HTTP: creates a claim through POST /api/claims/assess', async () => {
  await withProvider('demo', async () => {
    let savedInput;
    const prisma = createPrisma({
      saveAssessment: async (input) => {
        savedInput = input;
        return createPrisma().saveAssessment(input);
      },
    });
    await withHttpApi(new ClaimsService(prisma, {}, {}), async (baseUrl) => {
      const response = await postAssessment(baseUrl, validRequest);
      const data = await response.json();

      assert.equal(response.status, 201);
      assert.equal(data.claimId, 'new-claim');
      assert.equal(data.assessment.isDemo, true);
    });
    assert.equal(savedInput.claimId, undefined);
    assert.equal(savedInput.claimText, validRequest.claimText);
  });
});

test('HTTP: reassesses an existing claim with only its ID and new evidence', async () => {
  await withProvider('demo', async () => {
    let savedInput;
    const prisma = createPrisma({
      findClaimById: async (id) => ({
        id,
        text: 'Claim wording from PostgreSQL',
        productName: 'Product from PostgreSQL',
        population: 'Population from PostgreSQL',
      }),
      saveAssessment: async (input) => {
        savedInput = input;
        return {
          id: input.claimId,
          text: input.claimText,
          productName: input.productName,
          assessment: { id: 'assessment-new', claimId: input.claimId },
        };
      },
    });

    await withHttpApi(new ClaimsService(prisma, {}, {}), async (baseUrl) => {
      const response = await postAssessment(baseUrl, {
        claimId: 'claim-123',
        evidence: validRequest.evidence,
      });
      const data = await response.json();

      assert.equal(response.status, 201);
      assert.equal(data.claimId, 'claim-123');
      assert.equal(data.claim, 'Claim wording from PostgreSQL');
    });

    assert.equal(savedInput.claimId, 'claim-123');
    assert.equal(savedInput.claimText, 'Claim wording from PostgreSQL');
    assert.equal(savedInput.productName, 'Product from PostgreSQL');
    assert.equal(savedInput.population, 'Population from PostgreSQL');
    assert.equal(savedInput.evidence, validRequest.evidence);
  });
});

test('HTTP: returns 404 when reassessing a claim that does not exist', async () => {
  await withProvider('openai', async () => {
    let providerCalled = false;
    const prisma = createPrisma({ findClaimById: async () => null });
    const service = new ClaimsService(
      prisma,
      { evaluate: async () => { providerCalled = true; } },
      {},
    );

    await withHttpApi(service, async (baseUrl) => {
      const response = await postAssessment(baseUrl, {
        claimId: 'missing-claim',
        evidence: validRequest.evidence,
      });
      assert.equal(response.status, 404);
    });
    assert.equal(providerCalled, false);
  });
});

test('HTTP: returns 400 for an invalid reassessment request', async () => {
  await withProvider('demo', async () => {
    let lookupCalled = false;
    const service = new ClaimsService(
      createPrisma({ findClaimById: async () => { lookupCalled = true; return null; } }),
      {},
      {},
    );

    await withHttpApi(service, async (baseUrl) => {
      const response = await postAssessment(baseUrl, { claimId: 'claim-123' });
      assert.equal(response.status, 400);
    });
    assert.equal(lookupCalled, false);
  });
});

test('HTTP: returns 502 when the configured provider fails', async () => {
  await withProvider('openai', async () => {
    const service = new ClaimsService(
      createPrisma(),
      { evaluate: async () => { throw new Error('provider unavailable'); } },
      {},
    );

    await withHttpApi(service, async (baseUrl) => {
      const response = await postAssessment(baseUrl, validRequest);
      assert.equal(response.status, 502);
    });
  });
});

test('HTTP: returns 504 when the provider times out', async () => {
  await withProvider('openai', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const service = new ClaimsService(
      createPrisma(),
      { evaluate: async () => { throw timeout; } },
      {},
    );

    await withHttpApi(service, async (baseUrl) => {
      const response = await postAssessment(baseUrl, validRequest);
      assert.equal(response.status, 504);
    });
  });
});

test('HTTP: returns 503 without exposing database details', async () => {
  await withProvider('demo', async () => {
    const service = new ClaimsService(
      createPrisma({ saveAssessment: async () => { throw new Error('private connection string'); } }),
      {},
      {},
    );

    await withHttpApi(service, async (baseUrl) => {
      const response = await postAssessment(baseUrl, validRequest);
      const body = await response.text();
      assert.equal(response.status, 503);
      assert.equal(body.includes('private connection string'), false);
    });
  });
});
