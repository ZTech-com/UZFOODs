import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const username = this.config.get<string>('ADMIN_USERNAME') ?? 'admin';
    const password = this.config.get<string>('ADMIN_PASSWORD') ?? '';

    // Doimiy vaqtda taqqoslash (timing attack'dan himoya)
    const userOk = safeEqual(dto.username, username);
    const passOk = safeEqual(dto.password, password);

    if (!userOk || !passOk) {
      throw new UnauthorizedException("Login yoki parol noto'g'ri");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: 'admin',
      role: 'admin',
    });

    return { accessToken };
  }
}

/** Oddiy doimiy-vaqt string taqqoslash */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
