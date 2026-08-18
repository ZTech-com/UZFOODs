import {
  OrderForMessage,
  buildOrderKeyboard,
  formatOrderMessage,
  formatSum,
  formatTime,
  parseCallbackData,
} from './telegram.format';

const sampleOrder: OrderForMessage = {
  id: 1024,
  customer: {
    name: 'Aziza Karimova',
    phone: '+998 90 123 45 67',
    telegramUsername: null,
  },
  items: [
    { name: 'Osh', quantity: 2, price: 30000 },
    { name: "Lag'mon", quantity: 1, price: 25000 },
  ],
  totalAmount: 85000,
  requiredTime: '13:30',
  createdAt: new Date(2026, 7, 18, 12, 47, 3), // mahalliy 12:47:03
  status: 'PENDING',
};

describe('formatSum', () => {
  it('sonni so\'m formatida chiqaradi', () => {
    expect(formatSum(85000)).toBe("85,000 so'm");
    expect(formatSum(60000)).toBe("60,000 so'm");
  });
});

describe('formatTime', () => {
  it('HH:MM:SS formatida chiqaradi (24 soatlik)', () => {
    expect(formatTime(new Date(2026, 7, 18, 12, 47, 3))).toBe('12:47:03');
    expect(formatTime('2026-08-18T04:05:06.000Z'.replace('Z', ''))).toBeDefined();
  });
});

describe('formatOrderMessage', () => {
  it('texnik topshiriqdagi formatga to\'liq mos keladi', () => {
    const expected = [
      '🆕 YANGI BUYURTMA #1024',
      '',
      '👤 Mijoz: Aziza Karimova',
      '📞 Tel: +998 90 123 45 67',
      '',
      '🍽 Taomlar:',
      '- Osh (2 porsiya) — 60,000 so\'m',
      "- Lag'mon (1 porsiya) — 25,000 so'm",
      '',
      '💰 Jami: 85,000 so\'m',
      '⏰ Qachon tayyor bo\'lishi kerak: 13:30',
      '🕐 Buyurtma tushgan vaqt: 12:47:03',
    ].join('\n');

    expect(formatOrderMessage(sampleOrder)).toBe(expected);
  });

  it('includeStatus=true bo\'lganda holat qatorini qo\'shadi', () => {
    const text = formatOrderMessage(sampleOrder, true);
    expect(text).toContain('📌 Holat: ⏳ Kutilmoqda');
  });

  it('telegram username bo\'lsa qo\'shimcha qator chiqaradi', () => {
    const order = {
      ...sampleOrder,
      customer: { ...sampleOrder.customer, telegramUsername: '@aziza_k' },
    };
    const text = formatOrderMessage(order);
    expect(text).toContain('✈️ Telegram: @aziza_k');
  });
});

describe('buildOrderKeyboard', () => {
  it('PENDING holatda qabul/bekor tugmalari bo\'ladi', () => {
    const kb = buildOrderKeyboard(1024, 'PENDING');
    expect(kb).not.toBeNull();
    const buttons = kb!.inline_keyboard[0];
    expect(buttons[0]).toEqual({ text: '✅ Qabul qilish', callback_data: 'accept:1024' });
    expect(buttons[1]).toEqual({ text: '❌ Bekor qilish', callback_data: 'reject:1024' });
  });

  it('PREPARING holatda tayyor/bekor tugmalari bo\'ladi', () => {
    const kb = buildOrderKeyboard(1024, 'PREPARING');
    const buttons = kb!.inline_keyboard[0];
    expect(buttons[0]).toEqual({ text: '👨‍🍳 Tayyor', callback_data: 'ready:1024' });
  });

  it('terminal holatlarda tugmalar bo\'lmaydi', () => {
    expect(buildOrderKeyboard(1024, 'COMPLETED')).toBeNull();
    expect(buildOrderKeyboard(1024, 'CANCELLED')).toBeNull();
  });
});

describe('parseCallbackData', () => {
  it("'accept:5' ni pars qiladi", () => {
    expect(parseCallbackData('accept:5')).toEqual({ action: 'accept', orderId: 5 });
  });

  it('noto\'g\'ri data uchun null qaytaradi', () => {
    expect(parseCallbackData('nonsense')).toBeNull();
    expect(parseCallbackData('accept:abc')).toBeNull();
    expect(parseCallbackData('hack:5')).toBeNull();
  });
});
