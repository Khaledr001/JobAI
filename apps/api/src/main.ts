import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor.js";
import type { AppEnv } from "./config/env.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService<AppEnv, true>);

  app.setGlobalPrefix(configService.get("API_PREFIX", { infer: true }), {
    exclude: ["health", "ready"],
  });
  app.enableCors({
    origin: configService.get("API_CORS_ORIGINS", { infer: true }).split(","),
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.enableShutdownHooks();

  const port = configService.get("API_PORT", { infer: true });
  await app.listen(port);
  console.log(`api listening on :${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
