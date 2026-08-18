import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/serialize';

export interface MenuItemResponse {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category: string;
  available: boolean;
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableMenu(): Promise<MenuItemResponse[]> {
    const items = await this.prisma.menuItem.findMany({
      where: { available: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: toNumber(item.price),
      imageUrl: item.imageUrl,
      category: item.category,
      available: item.available,
    }));
  }
}
