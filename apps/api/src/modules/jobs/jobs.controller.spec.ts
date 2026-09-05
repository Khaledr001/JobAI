import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { JobsController } from "./jobs.controller.js";
import { JobsService } from "./jobs.service.js";

describe("JobsController", () => {
  async function build() {
    const ingestFromAdapter = vi.fn().mockResolvedValue({ discovered: 0 });
    const listCanonicalJobs = vi.fn().mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: JobsService, useValue: { ingestFromAdapter, listCanonicalJobs } },
      ],
    }).compile();
    return {
      controller: moduleRef.get(JobsController),
      ingestFromAdapter,
      listCanonicalJobs,
    };
  }

  it("builds a Greenhouse adapter for provider 'greenhouse' and delegates to the service", async () => {
    const { controller, ingestFromAdapter } = await build();
    await controller.ingest({ provider: "greenhouse", boardToken: "mixpanel" });
    expect(ingestFromAdapter).toHaveBeenCalledOnce();
    const adapter = ingestFromAdapter.mock.calls[0]![0];
    expect(adapter.id).toBe("greenhouse");
  });

  it("builds a Lever adapter for provider 'lever' and delegates to the service", async () => {
    const { controller, ingestFromAdapter } = await build();
    await controller.ingest({ provider: "lever", boardToken: "gynger" });
    expect(ingestFromAdapter).toHaveBeenCalledOnce();
    const adapter = ingestFromAdapter.mock.calls[0]![0];
    expect(adapter.id).toBe("lever");
  });

  it("delegates list() to the service", async () => {
    const { controller, listCanonicalJobs } = await build();
    await controller.list();
    expect(listCanonicalJobs).toHaveBeenCalledOnce();
  });
});
