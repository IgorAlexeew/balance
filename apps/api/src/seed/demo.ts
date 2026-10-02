import { randomInt } from 'node:crypto'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from '@balance/contracts'
import type { Prisma, User } from '@prisma/client'
import { prisma } from '../db'
import { rescheduleTaskReminder } from '../modules/reminders/service'

/**
 * Демо-данные для локальной разработки. Даты считаются относительно «сегодня»
 * в часовом поясе демо-пользователя, чтобы данные всегда выглядели свежими.
 */

const DEMO_EMAIL = 'demo@lifebalance.local'

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

function slugify(name: string): string {
  const slug = [...name.toLowerCase()]
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return slug || 'user'
}

async function upsertDemoUser(email: string, name: string, timezone: string): Promise<User> {
  const existing = await prisma.user.findFirst({ where: { email, isDemo: true } })
  return existing ?? prisma.user.create({ data: { email, name, timezone, isDemo: true } })
}

/**
 * Без имени — основной демо-аккаунт с заполненными данными.
 * С именем — отдельный пустой аккаунт (удобно проверять семейные группы вдвоём).
 */
export async function ensureDemoUser(name: string | null, timezone: string): Promise<User> {
  if (!name) {
    const user = await upsertDemoUser(DEMO_EMAIL, 'Александр', timezone)
    const seeded = await prisma.task.findFirst({ where: { createdById: user.id }, select: { id: true } })
    if (!seeded) await seedDemoData(user)
    return user
  }
  return upsertDemoUser(`${slugify(name)}@demo.lifebalance.local`, name, timezone)
}

export async function seedDemoData(user: User): Promise<void> {
  const tz = user.timezone
  const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
  const dayStr = (offset: number) => {
    const d = new Date(`${today}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + offset)
    return d.toISOString().slice(0, 10)
  }
  const at = (offset: number, hh: number, mm = 0) =>
    fromZonedTime(`${dayStr(offset)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`, tz)

  const anna = await upsertDemoUser('anna@demo.lifebalance.local', 'Анна', tz)
  const misha = await upsertDemoUser('misha@demo.lifebalance.local', 'Миша', tz)

  const group = await prisma.familyGroup.create({
    data: {
      name: 'Наша семья',
      description: 'Общие задачи, бюджет и события',
      inviteCode: Array.from(
        { length: INVITE_CODE_LENGTH },
        () => INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)],
      ).join(''),
      ownerId: user.id,
      members: {
        create: [
          { userId: user.id, role: 'owner' },
          { userId: anna.id, role: 'member' },
          { userId: misha.id, role: 'member' },
        ],
      },
    },
  })

  const tasks: Omit<Prisma.TaskUncheckedCreateInput, 'createdById'>[] = [
    {
      title: 'Купить продукты на неделю',
      description: 'Список: овощи, фрукты, крупы, курица, молочное',
      deadline: at(0, 19),
      assigneeId: user.id,
      groupId: group.id,
      reminder: { create: { type: 'before', offsetMinutes: 60 } },
    },
    {
      title: 'Записаться к стоматологу',
      priority: 'high',
      deadline: at(1, 12),
      reminder: { create: { type: 'once', fireAt: at(1, 9, 30) } },
    },
    {
      title: 'Утренняя зарядка',
      description: '20 минут: разминка, пресс, планка',
      priority: 'low',
      reminder: { create: { type: 'morning', time: '08:00' } },
    },
    {
      title: 'Оплатить коммунальные услуги',
      priority: 'urgent',
      deadline: at(3, 18),
      assigneeId: anna.id,
      groupId: group.id,
      reminder: { create: { type: 'before', offsetMinutes: 1440 } },
    },
    {
      title: 'Собрать домашнюю аптечку',
      description: 'Обновить лекарства, проверить сроки годности',
      priority: 'low',
      deadline: at(7, 20),
      groupId: group.id,
    },
    {
      title: 'Позвонить родителям',
      groupId: group.id,
      reminder: { create: { type: 'weekly', daysOfWeek: '7', time: '18:00' } },
    },
    {
      title: 'Сдать отчёт по проекту',
      priority: 'urgent',
      deadline: at(0, 18, 30),
      reminder: { create: { type: 'at_deadline' } },
    },
    { title: 'Продлить страховку автомобиля', priority: 'high', deadline: at(-1, 15) },
    {
      title: 'Оформить подписку на музыку',
      priority: 'low',
      status: 'done',
      completedAt: at(-2, 13),
      deadline: at(-2, 18),
    },
  ]
  for (const data of tasks) {
    const task = await prisma.task.create({ data: { ...data, createdById: user.id } })
    await rescheduleTaskReminder(task.id)
  }

  // Операции текущего месяца: день месяца не позже сегодняшнего
  const todayDay = Number(today.slice(8, 10))
  const monthPrefix = today.slice(0, 8)
  const tx = (
    day: number,
    type: 'income' | 'expense',
    rubles: number,
    category: string,
    description: string,
    by: User = user,
    groupId: string | null = null,
  ) => ({
    type,
    amount: rubles * 100,
    category,
    description,
    date: `${monthPrefix}${String(Math.min(day, todayDay)).padStart(2, '0')}`,
    userId: by.id,
    groupId,
  })
  await prisma.transaction.createMany({
    data: [
      tx(5, 'income', 85000, 'Зарплата', 'Основная работа'),
      tx(12, 'income', 14000, 'Фриланс', 'Вёрстка лендинга'),
      tx(3, 'expense', 680, 'Кафе и рестораны', 'Кофе с коллегами'),
      tx(4, 'expense', 3200, 'Продукты', 'Базовая закупка'),
      tx(6, 'expense', 6500, 'Жильё и ЖКХ', 'Коммунальные платежи'),
      tx(7, 'expense', 1200, 'Продукты', 'Фрукты и овощи', anna, group.id),
      tx(8, 'expense', 890, 'Кафе и рестораны', 'Пиццерия в пятницу', anna, group.id),
      tx(9, 'expense', 600, 'Связь и интернет', 'Мобильная связь'),
      tx(10, 'expense', 2400, 'Здоровье', 'Витамины и анализы'),
      tx(11, 'expense', 4300, 'Одежда', 'Кроссовки'),
      tx(14, 'expense', 1500, 'Развлечения', 'Кино всей семьёй', user, group.id),
      tx(15, 'expense', 3500, 'Подарки', 'Подарок маме', anna, group.id),
      tx(16, 'expense', 2000, 'Спорт', 'Бассейн, абонемент'),
      tx(17, 'expense', 950, 'Транспорт', 'Такси'),
      tx(18, 'expense', 2650, 'Продукты', 'Овощи, мясо, молочка'),
      tx(21, 'expense', 1900, 'Дом и быт', 'Бытовая химия'),
      tx(22, 'expense', 5400, 'Продукты', 'Большая закупка на неделю', user, group.id),
    ],
  })

  await prisma.calendarEvent.createMany({
    data: [
      {
        title: 'Семейный ужин',
        description: 'Готовим вместе',
        start: at(0, 19),
        end: at(0, 21),
        color: 'emerald',
        userId: user.id,
        groupId: group.id,
      },
      { title: 'Приём у врача', start: at(2, 10), end: at(2, 11), color: 'amber', userId: user.id },
      {
        title: 'Футбольный матч Миши',
        start: at(4, 16),
        end: at(4, 18),
        color: 'violet',
        userId: user.id,
        groupId: group.id,
      },
      {
        title: 'День рождения Анны',
        start: at(5, 0),
        end: at(5, 23, 59),
        allDay: true,
        color: 'rose',
        userId: user.id,
        groupId: group.id,
      },
      { title: 'Поход в кино', start: at(6, 19, 30), end: at(6, 22), color: 'teal', userId: user.id },
      {
        title: 'Родительское собрание',
        start: at(3, 18),
        end: at(3, 19, 30),
        color: 'orange',
        userId: anna.id,
        groupId: group.id,
      },
    ],
  })

  await prisma.userNotification.create({
    data: {
      userId: user.id,
      title: 'Добро пожаловать в LifeBalance!',
      body: 'Это демо-данные: задачи, бюджет, события и семейная группа уже заполнены.',
      type: 'info',
    },
  })
}
