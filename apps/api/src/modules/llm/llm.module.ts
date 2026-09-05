import { resolve } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeepSeekProvider, withCassette, type LlmProvider } from "@jobhunter/llm";
import type { AppEnv } from "../../config/env.js";
import { LLM_PROVIDER } from "./llm-provider.token.js";
import { LlmController } from "./llm.controller.js";
import { LlmService } from "./llm.service.js";

@Module({
  controllers: [LlmController],
  providers: [
    LlmService,
    {
      provide: LLM_PROVIDER,
      useFactory: (configService: ConfigService<AppEnv, true>): LlmProvider => {
        const raw = new DeepSeekProvider({
          apiKey: configService.get("DEEPSEEK_API_KEY", { infer: true }),
        });
        return withCassette(raw, {
          mode: configService.get("LLM_MODE", { infer: true }),
          cassettesDir: resolve(
            process.cwd(),
            configService.get("LLM_CASSETTES_DIR", { infer: true }),
          ),
          seed: configService.get("LLM_SEED", { infer: true }),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [LlmService],
})
export class LlmModule {}
