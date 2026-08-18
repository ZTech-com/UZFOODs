import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'secret123',
      };
      return values[key];
    }),
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
  };

  const service = new AuthService(config as never, jwtService as never);

  it('to\'g\'ri login/parol bilan JWT qaytaradi', async () => {
    const result = await service.login({ username: 'admin', password: 'secret123' });
    expect(result.accessToken).toBe('signed-jwt-token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'admin', role: 'admin' }),
    );
  });

  it('noto\'g\'ri parol bilan UnauthorizedException tashlaydi', async () => {
    await expect(
      service.login({ username: 'admin', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('noto\'g\'ri username bilan UnauthorizedException tashlaydi', async () => {
    await expect(
      service.login({ username: 'hacker', password: 'secret123' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
