import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('admin')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Login — brute-force himoyasi: IP'ga 10 urinish / daqiqa */
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
