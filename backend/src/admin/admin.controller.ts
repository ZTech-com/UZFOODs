import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/create-menu-item.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { BulkActionDto } from './dto/bulk-action.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** Dashboard statistika (KPI + analytics) */
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  /** Buyurtmalar ro'yxati (holat/sana/qidiruv/summa/sort filtrlari bilan) */
  @Get('orders')
  listOrders(@Query() query: ListOrdersQueryDto) {
    return this.adminService.listOrders(query);
  }

  /** CSV export (filterlangan ma'lumot, server-side) */
  @Get('orders/export')
  async exportOrders(@Query() query: ListOrdersQueryDto, @Res() res: Response) {
    const csv = await this.adminService.exportOrdersCSV(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }

  /** O'chirilgan (soft-deleted) buyurtmalar */
  @Get('orders/deleted')
  listDeletedOrders(@Query() query: ListOrdersQueryDto) {
    return this.adminService.listDeletedOrders(query);
  }

  /** Bulk action: complete / cancel / delete */
  @Post('orders/bulk')
  bulkAction(
    @Body() dto: BulkActionDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const admin = (req as unknown as { user?: { userId?: string } }).user?.userId ?? 'admin';
    return this.adminService.bulkAction(dto, admin, ip);
  }

  /** Soft delete (order tarixdan yo'qolmaydi) */
  @Delete('orders/:id')
  softDeleteOrder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const admin = (req as unknown as { user?: { userId?: string } }).user?.userId ?? 'admin';
    return this.adminService.softDeleteOrder(id, admin, ip);
  }

  /** Soft-deleted buyurtmani tiklash */
  @Post('orders/:id/restore')
  restoreOrder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const admin = (req as unknown as { user?: { userId?: string } }).user?.userId ?? 'admin';
    return this.adminService.restoreOrder(id, admin, ip);
  }

  /** PERMANENT DELETE — faqat o'chirilgan buyurtmalar uchun, qaytarib bo'lmaydi */
  @Delete('orders/:id/permanent')
  permanentDeleteOrder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const admin = (req as unknown as { user?: { userId?: string } }).user?.userId ?? 'admin';
    return this.adminService.permanentDeleteOrder(id, admin, ip);
  }

  // Menyu boshqaruvi
  @Get('menu-items')
  listMenuItems() {
    return this.adminService.listMenuItems();
  }

  @Post('menu-items')
  createMenuItem(@Body() dto: CreateMenuItemDto, @Req() req: Request, @Ip() ip: string) {
    const admin = (req as unknown as { user?: { userId?: string } }).user?.userId ?? 'admin';
    return this.adminService.createMenuItem(dto, admin, ip);
  }

  @Patch('menu-items/:id')
  updateMenuItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMenuItemDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const admin = (req as unknown as { user?: { userId?: string } }).user?.userId ?? 'admin';
    return this.adminService.updateMenuItem(id, dto, admin, ip);
  }

  @Delete('menu-items/:id')
  removeMenuItem(@Param('id', ParseIntPipe) id: number, @Req() req: Request, @Ip() ip: string) {
    const admin = (req as unknown as { user?: { userId?: string } }).user?.userId ?? 'admin';
    return this.adminService.removeMenuItem(id, admin, ip);
  }
}
