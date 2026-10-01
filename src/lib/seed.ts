import { db } from '@/lib/db'
import type { User } from '@prisma/client'

/**
 * Демо-данные для предпросмотра приложения.
 * Все «сегодня/завтра» считаются в timezone Europe/Saratov (UTC+4),
 * т.к. сервер работает в UTC, а данные должны выглядеть локально корректно.
 */
const SARATOV_OFFSET_MS = 4 * 60 * 60 * 1000

/** Локальное "сейчас" в Саратове как Date (сдвигаем, читаем UTC-поля) */
function localNow(): Date {
  return new Date(Date.now() + SARATOV_OFFSET_MS)
}

/** Локальный день месяца в Саратове (0 = сегодня, 1 = завтра, -1 = вчера) */
function localDay(offsetDays: number): { y: number; m: number; d: number } {
  const base = new Date(localNow().getTime() + offsetDays * 24 * 60 * 60 * 1000)
  return { y: base.getUTCFullYear(), m: base.getUTCMonth(), d: base.getUTCDate() }
}

/** Дата с локальным временем в Саратове -> корректный момент UTC */
function atLocal(dayOffset: number, hours: number, minutes = 0): Date {
  const { y, m, d } = localDay(dayOffset)
  return new Date(Date.UTC(y, m, d, hours - 4, minutes, 0, 0))
}

/** Транзакция: дата стабильно хранится как полдень UTC */
function txDate(dayOffset: number): Date {
  const { y, m, d } = localDay(dayOffset)
  return new Date(Date.UTC(y, m, d, 12, 0, 0, 0))
}

const DEMO_EMAIL = 'demo@lifebalance.app'

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'user'
}

async function upsertUser(email: string, name: string): Promise<User> {
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return existing
  return db.user.create({ data: { email, name } })
}

/** Основной демо-пользователь с богатыми данными либо новый пользователь по имени */
export async function ensureDemoUser(name: string | null): Promise<{ id: string; name: string | null; email: string | null }> {
  if (!name) {
    const user = await upsertUser(DEMO_EMAIL, 'Александр')
    const alreadySeeded = await db.task.findFirst({ where: { createdById: user.id } })
    if (!alreadySeeded) {
      await seedRichDemoData(user.id)
    }
    return user
  }
  // Пользователь по имени — свежий аккаунт (для теста входа в группы)
  const email = `${slugify(name)}@demo.lifebalance`
  return upsertUser(email, name)
}

async function seedRichDemoData(userId: string): Promise<void> {
  const anna = await upsertUser('anna@demo.lifebalance', 'Анна')
  const misha = await upsertUser('misha@demo.lifebalance', 'Миша')

  const group = await db.familyGroup.create({
    data: {
      name: 'Наша семья',
      description: 'Общие задачи, бюджет и события',
      inviteCode: 'DEMO24',
      ownerId: userId,
      members: {
        create: [
          { userId, role: 'owner' },
          { userId: anna.id, role: 'member' },
          { userId: misha.id, role: 'member' },
        ],
      },
    },
  })

  // ===== Задачи =====
  await db.task.create({
    data: {
      title: 'Купить продукты на неделю',
      description: 'Список: овощи, фрукты, крупы, курица, молочное',
      priority: 'medium',
      deadline: atLocal(0, 19, 0),
      assigneeId: userId,
      createdById: userId,
      groupId: group.id,
      reminder: { create: { type: 'before', offsetMinutes: 60 } },
    },
  })
  await db.task.create({
    data: {
      title: 'Записаться к стоматологу',
      priority: 'high',
      deadline: atLocal(1, 12, 0),
      createdById: userId,
      reminder: { create: { type: 'once', fireAt: atLocal(1, 9, 30) } },
    },
  })
  await db.task.create({
    data: {
      title: 'Утренняя зарядка',
      description: '20 минут: разминка, пресс, планка',
      priority: 'low',
      createdById: userId,
      reminder: { create: { type: 'morning', time: '08:00' } },
    },
  })
  await db.task.create({
    data: {
      title: 'Оплатить коммунальные услуги',
      priority: 'urgent',
      deadline: atLocal(3, 18, 0),
      assigneeId: anna.id,
      createdById: userId,
      groupId: group.id,
      reminder: { create: { type: 'before', offsetMinutes: 1440 } },
    },
  })
  await db.task.create({
    data: {
      title: 'Собрать домашнюю аптечку',
      description: 'Обновить лекарства, проверить сроки годности',
      priority: 'low',
      deadline: atLocal(7, 20, 0),
      createdById: userId,
      groupId: group.id,
    },
  })
  await db.task.create({
    data: {
      title: 'Читать книгу перед сном',
      description: 'Минимум 15 страниц',
      priority: 'low',
      deadline: atLocal(5, 22, 0),
      createdById: userId,
      reminder: { create: { type: 'daily', time: '21:30' } },
    },
  })
  await db.task.create({
    data: {
      title: 'Позвонить родителям',
      priority: 'medium',
      createdById: userId,
      groupId: group.id,
      reminder: { create: { type: 'weekly', daysOfWeek: '7', time: '18:00' } },
    },
  })
  await db.task.create({
    data: {
      title: 'Сдать отчёт по проекту',
      priority: 'urgent',
      deadline: atLocal(0, 18, 30),
      createdById: userId,
      reminder: { create: { type: 'at_deadline' } },
    },
  })
  await db.task.create({
    data: {
      title: 'Продлить страховку автомобиля',
      priority: 'high',
      deadline: atLocal(-1, 15, 0), // просрочена
      createdById: userId,
    },
  })
  await db.task.create({
    data: {
      title: 'Оформить подписку на музыку',
      priority: 'low',
      status: 'done',
      completedAt: atLocal(-2, 13, 0),
      deadline: atLocal(-2, 18, 0),
      createdById: userId,
    },
  })

  // ===== Транзакции за текущий месяц =====
  const todayLocal = localNow().getUTCDate()
  const mkTx = (
    day: number,
    type: 'income' | 'expense',
    amount: number,
    category: string,
    description?: string,
    byUser?: string,
    groupId?: string,
  ) => {
    // если день месяца ещё не наступил — сдвигаем ближе к сегодня
    const clamped = Math.min(day, Math.max(1, todayLocal - 1))
    const date = txDate(0 - (todayLocal - clamped))
    return db.transaction.create({
      data: {
        type,
        amount,
        category,
        description: description ?? null,
        date,
        userId: byUser ?? userId,
        groupId: groupId ?? null,
      },
    })
  }

  await mkTx(5, 'income', 85000, 'Зарплата', 'Основная работа')
  await mkTx(12, 'income', 14000, 'Фриланс', 'Вёрстка лендинга')
  await mkTx(3, 'expense', 680, 'Кафе и рестораны', 'Кофе с коллегами')
  await mkTx(4, 'expense', 3200, 'Продукты', 'Магнит — базовая закупка')
  await mkTx(6, 'expense', 6500, 'Жильё и ЖКХ', 'Коммунальные платежи')
  await mkTx(7, 'expense', 1200, 'Продукты', 'Фрукты и овощи', anna.id, group.id)
  await mkTx(8, 'expense', 890, 'Кафе и рестораны', 'Пиццерия в пятницу', anna.id, group.id)
  await mkTx(9, 'expense', 600, 'Связь и интернет', 'Мобильная связь')
  await mkTx(10, 'expense', 2400, 'Здоровье', 'Витамины и анализы')
  await mkTx(11, 'expense', 4300, 'Одежда', 'Кроссовки')
  await mkTx(13, 'expense', 2800, 'Продукты', 'Пятёрочка')
  await mkTx(14, 'expense', 1500, 'Развлечения', 'Кино всей семьёй', userId, group.id)
  await mkTx(15, 'expense', 3500, 'Подарки', 'Подарок маме', anna.id, group.id)
  await mkTx(16, 'expense', 2000, 'Спорт', 'Бассейн, абонемент')
  await mkTx(17, 'expense', 950, 'Транспорт', 'Такси')
  await mkTx(18, 'expense', 2650, 'Продукты', 'Овощи, мясо, молочка')
  await mkTx(19, 'expense', 1240, 'Транспорт', 'Проездной пополнение')
  await mkTx(20, 'expense', 780, 'Кафе и рестораны', 'Бизнес-ланч')
  await mkTx(21, 'expense', 1900, 'Дом и быт', 'Бытовая химия')
  await mkTx(22, 'expense', 5400, 'Продукты', 'Большая закупка на неделю', userId, group.id)
  await mkTx(23, 'expense', 1100, 'Развлечения', 'Настольные игры')
  await mkTx(24, 'expense', 620, 'Продукты', 'Хлеб, молоко, яйца')

  // ===== События календаря =====
  await db.calendarEvent.create({
    data: {
      title: 'Семейный ужин',
      description: 'Готовим вместе пасту карбонара',
      start: atLocal(0, 19, 0),
      end: atLocal(0, 21, 0),
      color: 'emerald',
      userId,
      groupId: group.id,
    },
  })
  await db.calendarEvent.create({
    data: {
      title: 'Приём у врача',
      description: 'Стоматолог, ул. Московская',
      start: atLocal(2, 10, 0),
      end: atLocal(2, 11, 0),
      color: 'amber',
      userId,
    },
  })
  await db.calendarEvent.create({
    data: {
      title: 'Футбольный матч Миши',
      start: atLocal(4, 16, 0),
      end: atLocal(4, 18, 0),
      color: 'violet',
      userId,
      groupId: group.id,
    },
  })
  await db.calendarEvent.create({
    data: {
      title: 'День рождения Анны',
      start: atLocal(5, 0, 0),
      end: atLocal(6, 0, 0),
      allDay: true,
      color: 'rose',
      userId,
      groupId: group.id,
    },
  })
  await db.calendarEvent.create({
    data: {
      title: 'Поход в кино',
      start: atLocal(6, 19, 30),
      end: atLocal(6, 22, 0),
      color: 'teal',
      userId,
    },
  })
  await db.calendarEvent.create({
    data: {
      title: 'Родительское собрание в школе',
      start: atLocal(3, 18, 0),
      end: atLocal(3, 19, 30),
      color: 'orange',
      userId: anna.id,
      groupId: group.id,
    },
  })

  // ===== Уведомления =====
  await db.userNotification.create({
    data: {
      userId,
      title: 'Добро пожаловать в LifeBalance!',
      body: 'Это демо-данные: задачи, бюджет, события и семейная группа уже заполнены. Исследуйте разделы!',
      type: 'info',
    },
  })
  await db.userNotification.create({
    data: {
      userId,
      title: 'Напоминание: Утренняя зарядка',
      body: 'Время выполнить зарядку — 20 минут активности',
      type: 'reminder',
      read: true,
    },
  })
}
