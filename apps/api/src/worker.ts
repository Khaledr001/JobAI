import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

/**
 * No HTTP listener -- an application context only. Once WorkerModule (D5)
 * registers @Processor() consumers, this process is where they run. Today
 * it registers zero processors, by design: nothing has been built yet that
 * needs one.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  console.log("worker context started (PROCESS_ROLE=worker)");
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
