import { Controller, Get, Query } from "@nestjs/common";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import { ListTaxonomyNodesQuerySchema, type ListTaxonomyNodesQueryDto } from "./dto.js";
import { TaxonomyService } from "./taxonomy.service.js";

@Controller("taxonomy")
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get("nodes")
  listNodes(
    @Query(zodPipe(ListTaxonomyNodesQuerySchema)) query: ListTaxonomyNodesQueryDto,
  ) {
    return this.taxonomyService.listNodes(query);
  }
}
