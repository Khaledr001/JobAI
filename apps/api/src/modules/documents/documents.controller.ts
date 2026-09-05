import { Body, Controller, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { AuthenticatedUser } from "../auth/dto.js";
import { GenerateDocumentSchema, type GenerateDocumentDto } from "./dto.js";
import { DocumentsService } from "./documents.service.js";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post("generate")
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(GenerateDocumentSchema)) dto: GenerateDocumentDto,
  ) {
    return this.documentsService.generate(user.sub, dto);
  }
}
