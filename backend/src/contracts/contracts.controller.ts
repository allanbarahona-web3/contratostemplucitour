import { Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ContractsService } from "./contracts.service";

@Controller("contracts")
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @UseGuards(JwtAuthGuard)
  @Post("next-number")
  reserveNextNumber(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
    },
  ) {
    return this.contractsService.reserveNextNumber(req.user);
  }
}
