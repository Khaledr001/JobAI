import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator.js";
import { HealthService } from "./health.service.js";

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness: process is up. Deliberately does not touch the database. */
  @Public()
  @Get("health")
  @HttpCode(HttpStatus.OK)
  getHealth() {
    return this.healthService.getHealth();
  }

  /** Readiness: process is up AND its dependencies are reachable. */
  @Public()
  @Get("ready")
  async getReadiness() {
    const result = await this.healthService.getReadiness();
    if (result.status === "not_ready") {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
