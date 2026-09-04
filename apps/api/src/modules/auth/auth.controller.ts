import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator.js";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import {
  LoginSchema,
  RefreshSchema,
  type AuthTokens,
  type LoginDto,
  type RefreshDto,
} from "./dto.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body(zodPipe(LoginSchema)) dto: LoginDto): Promise<AuthTokens> {
    return this.authService.login(dto);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body(zodPipe(RefreshSchema)) dto: RefreshDto): Promise<AuthTokens> {
    return this.authService.refresh(dto);
  }
}
