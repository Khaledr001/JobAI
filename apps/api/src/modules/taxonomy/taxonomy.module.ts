import { Module } from "@nestjs/common";
import { TaxonomyController } from "./taxonomy.controller.js";
import { TaxonomyService } from "./taxonomy.service.js";

@Module({
  controllers: [TaxonomyController],
  providers: [TaxonomyService],
})
export class TaxonomyModule {}
