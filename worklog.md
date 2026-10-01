# Worklog — LifeBalance App

## Спецификация проекта (обязательна для всех агентов)

**LifeBalance** — приложение для баланса жизни: задачи с гибкими напоминаниями, семейный бюджет с ИИ-анализом, календарь, семейные группы. Вход через Яндекс ID (NextAuth) + демо-вход.

**Стек**: Next.js 16 App Router, TypeScript strict, Tailwind CSS 4, shadcn/ui (все компоненты в `src/components/ui/`), Prisma + SQLite (`import { db } from '@/lib/db'`), NextAuth v4, TanStack Query v5, Zustand, recharts, date-fns v4 (+locale ru), sonner (тосты), framer-motion.

**Ключевые правила**:
- Только маршрут `/` (весь UI — переключение вкладок в шелле). API — в `/api/*`.
- Никаких Server Actions — только API-роуты. Никаких новых цветов indigo/blue.
- Весь UI на русском языке. Валюта — ₽.
- Footer прижат к низу (wrapper `min-h-screen flex flex-col`, footer `mt-auto`).
- Prisma-примитивы: никаких списков в скалярах (daysOfWeek — строка "1,3,5").

### Существующий фундамент (Task 1 — ГОТОВО)

- `prisma/schema.prisma`: User, FamilyGroup, FamilyMember, Task, Reminder (1:1 c Task), Transaction, CalendarEvent, UserNotification. Схема запушена.
- `src/lib/auth.ts`: authOptions (Yandex OAuth если заданы env YANDEX_CLIENT_ID/SECRET + Credentials провайдер `demo` с сидированием), `getSessionUserId()`, `getAuthSession()`, `isYandexConfigured`.
- `src/lib/seed.ts`: `ensureDemoUser(name|null)` — демо-пользователь demo@lifebalance.app (Александр) с богатым сидом: группа «Наша семья» (DEMO24, члены: Александр owner, Анна, Миша), 10 задач с разными напоминаниями, 22 транзакции текущего месяца, 6 событий, 2 уведомления.
- `src/lib/types.ts`: ВСЕ DTO-типы (TaskDTO, TaskInput, ReminderDTO, ReminderInput, TransactionDTO, TransactionInput, BudgetSummaryDTO, CalendarEventDTO, CalendarEventInput, FamilyGroupDTO, FamilyMemberDTO, UserNotificationDTO, TaskFilterStatus, enum-списки TASK_STATUSES/TASK_PRIORITIES/REMINDER_TYPES/EVENT_COLORS).
- `src/lib/categories.ts`: EXPENSE_CATEGORIES/INCOME_CATEGORIES, `getCategory(name)` — иконка + классы чипа.
- `src/lib/dto.ts`: мапперы `taskToDTO` (включая reminder/assignee/createdBy), `transactionToDTO` (+user), `eventToDTO` (+user), `groupWithMembersToDTO`, `notificationToDTO`. Типы: `TaskWithRelations`, `TransactionWithUser`, `EventWithUser`, `GroupWithMembers`.
- `src/lib/api-helpers.ts`: `ApiError`, `requireUserId()` (401), `assertGroupAccess(userId, groupId)` (403), `handleApiError(e)`, `parseMonthParam`, `monthRange`, `transactionDate("YYYY-MM-DD")` → Date (полдень UTC), `parseIsoDate`, `parseIdParam`, `reqString`, `optString`, `numField`.
- `/api/auth/*` — работает (проверено curl). Авторизация по JWT, session.user.id = id из БД.

### Контекст групп (ВАЖНО для всех API)

Приложение имеет переключатель контекста: `groupId === null` → личные данные (записи с `groupId: null`), `groupId === "<id>"` → данные семейной группы. Доступ к группе — только через `assertGroupAccess` (членство в FamilyMember). Записи группы видят ВСЕ члены группы.

### Спецификация API (детальные задания выданы агентам 2-a/2-b/2-c)

**Task 2-a — Задачи/Напоминания/Уведомления:**
- `GET /api/tasks?status=all|todo|done|overdue&scope=personal|all|<groupId>` — задачи пользователя (созданные им, назначенные ему ИЛИ входящие в его группы), с include reminder+assignee+createdBy, сортировка: незавершённые по deadline asc (nulls last), затем createdAt desc. `overdue` = todo + deadline < now.
- `POST /api/tasks` body TaskInput → создать (+reminder upsert при наличии). Валидация: title 1..200.
- `PATCH /api/tasks/[id]` — частичное обновление (права: создатель, назначенный или член группы задачи); reminder: передан объект → replace, `null` → удалить. `status:'done'` → проставить completedAt.
- `DELETE /api/tasks/[id]`.
- `GET /api/reminders/due?tz=<минуты>` — движок: для доступных задач с включённым reminder (и status='todo'), вычислить срабатывания в окне [max(lastFiredAt ?? now-2m, now-10m), now], где now-локальное = new Date(Date.now() + tz*60000). Типы: at_deadline (в момент deadline), before (deadline - offsetMinutes), daily/morning (каждый день в time "HH:MM"), weekly (в time по дням daysOfWeek, 1=Пн..7=Вс), once (fireAt). При срабатывании: создать UserNotification (userId = текущий пользователь, title "🔔 Напоминание", body "«{task.title}» — {описание когда}"), обновить lastFiredAt=now. Вернуть созданные уведомления.
- `GET /api/notifications?unread=1` — последние 50 (desc).
- `PATCH /api/notifications` body `{ids?: string[], all?: boolean}` — отметить прочитанными.

**Task 2-b — Бюджет:**
- `GET /api/transactions?month=YYYY-MM&groupId=<id|null>` — транзакции месяца (+user), date desc, createdAt desc. groupId null/отсутствует → личные; иначе группа (assertGroupAccess).
- `POST /api/transactions` body TransactionInput → создать (amount > 0 ≤ 10^9, date YYYY-MM-DD через transactionDate()).
- `PATCH /api/transactions/[id]`, `DELETE /api/transactions/[id]` (права: владелец записи; для групповых — любой член группы).
- `GET /api/budget/summary?month=YYYY-MM&groupId=` → BudgetSummaryDTO (totalIncome, totalExpense, balance, byCategory[] отсортирован по total desc, byDay[] на все дни месяца).

**Task 2-c — Календарь/Семья:**
- `GET /api/events?from=ISO&to=ISO&groupId=` — события, пересекающие диапазон (+user), start asc.
- `POST /api/events` body CalendarEventInput (title 1..200, end > start).
- `PATCH /api/events/[id]`, `DELETE /api/events/[id]`.
- `GET /api/family` — мои группы (owner + все где член) → GroupWithMembers → groupWithMembersToDTO, sorted by createdAt asc.
- `POST /api/family` body `{name, description?}` → создать группу + owner membership, inviteCode = 6 символов A-Z0-9 без неоднозначных (без O/0/I/1).
- `POST /api/family/join` body `{inviteCode}` → добавить членство (404 если код не найден, 409 если уже член).
- `POST /api/family/leave` body `{groupId}` → выйти; если owner и есть другие члены → передать владение самому раннему члену; если owner и членов нет → удалить группу.
- `DELETE /api/family/[id]` — только owner, каскадное удаление группы (задачи/транзакции/события группы удалятся каскадом).

**Общие конвенции всех API-роутов:**
```ts
import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
// try { ... } catch (e) { return handleApiError(e) }
// 401: await requireUserId(); доступ к группе: await assertGroupAccess(userId, groupId)
// ответы всегда через DTO-мапперы из '@/lib/dto'
```
Все ответы JSON: список → массив DTO; объект → DTO; ошибки → `{error: string}` на русском.

### Спецификация фронтенда

- `/` = `src/app/page.tsx` (клиентский): если нет сессии → `AuthScreen`, иначе `AppShell` с вкладками: dashboard | tasks | budget | calendar | family.
- `src/lib/store.ts` (Zustand): `{view, setView, groupId, setGroupId, taskDialogTask, setTaskDialogTask, ...}` — groupId: string | null (null = личный контекст).
- `src/lib/api.ts` — типизированный fetch-клиент для всех эндпоинтов.
- `src/lib/format.ts` — форматтеры (деньги ₽, даты date-fns ru, подписи приоритетов/напоминаний, humanizeReminder).
- Хелпер даты запроса месяца: клиент шлёт `month=YYYY-MM` и `groupId=<id|null>`; переключатель «Личные/группа» в топбаре.
- Design-токены: primary = emerald; успеха = emerald, просрочено/расходы = rose, доходы = emerald/teal, дедлайны = amber. Карточки `rounded-xl border shadow-sm`. Анимации — лёгкие (framer-motion fade/slide). Иконки lucide-react.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Фундамент — схема Prisma, авторизация NextAuth (Яндекс + демо), общие библиотеки, демо-данные

Work Log:
- Изучен проект: Next.js 16 + TS + shadcn/ui + Prisma/SQLite, dev-сервер работает на 3000
- Составлена схема БД (User, FamilyGroup, FamilyMember, Task, Reminder, Transaction, CalendarEvent, UserNotification), `bun run db:push` — успешно
- Написаны src/lib/types.ts (DTO), categories.ts, dto.ts (мапперы), api-helpers.ts (auth/валидация/ошибки)
- Настроен NextAuth v4: Яндекс-провайдер (env-gated) + демо-провайдер с сидированием (src/lib/auth.ts, src/lib/seed.ts, src/types/next-auth.d.ts, /api/auth/[...nextauth])
- .env: NEXTAUTH_SECRET/URL + пустые YANDEX_CLIENT_ID/SECRET (демо-режим активен)
- E2E-проверка curl: /api/auth/providers ✓, демо-вход ✓, сессия возвращает id ✓, сид: 3 пользователя, 1 группа, 10 задач, 22 транзакции, 6 событий, 2 уведомления ✓

Stage Summary:
- Фундамент готов и проверен. NextAuth v4 совместим с Next 16 (проверено).
- Демо-вход: пустое имя → demo@lifebalance.app «Александр» с богатым сидом; имя → свежий пользователь для теста групп.
- Все DTO/хелперы — единый источник для последующих агентов. Спецификации API в этом worklog — обязательны к точному исполнению.

---
Task ID: 3
Agent: main (Z.ai Code)
Task: Фронтенд-фундамент — layout, providers, API-клиент, стор, экран авторизации, шелл, дашборд

Work Log:
- globals.css: primary переключён на emerald (light: emerald-600, dark: emerald-500), accent/ring/chart/sidebar-переменные в тонах emerald/amber/rose/violet/teal (без indigo/blue)
- layout.tsx: шрифт Inter (latin+cyrillic), lang="ru", русские метаданные, Providers (SessionProvider + QueryClientProvider + ThemeProvider next-themes + Toaster sonner richColors)
- src/lib/api.ts: типизированный клиент для ВСЕХ эндпоинтов (api.tasks/transactions/events/family/notifications/reminders/budget) — субагенты API обязаны точно соответствовать этим путям и схемам
- src/lib/store.ts (zustand): view + groupId
- src/lib/format.ts: fmtMoney, fmtDate/DateTime/Time, relativeDay, isOverdueTask, PRIORITY_LABELS/CHIP_CLASSES, humanizeReminder, monthTitle, currentMonth, shiftMonth, initials, greeting
- auth-screen.tsx: сплит-экран, кнопка Яндекс ID (активна если /api/auth/providers содержит yandex, inline-SVG логотип «Я»), демо-вход с необязательным именем
- app-shell.tsx: сайдбар (десктоп) + нижняя навигация (мобайл, safe-area), топбар с GroupSwitcher (Личные/группы) + ThemeToggle (CSS dark:, без mounted-паттерна) + NotificationsBell + UserMenu, footer mt-auto прижат к низу
- notifications-bell.tsx (Popover, refetch 60с), reminders-watcher.tsx (опрос /api/reminders/due каждые 45с, тосты + browser Notification)
- views/dashboard.tsx — РЕФЕРЕНСНАЯ ВЬЮ для субагентов: stat-карточки, задачи на сегодня с чекбоксами, просроченные, события, последние траты
- views/{tasks,budget,calendar,family}.tsx — заглушки (будут перезаписаны субагентами 4-a..4-d)
- page.tsx: splash → AuthScreen | AppShell по сессии
- Исправлены ошибки линтера (set-state-in-effect, preserve-manual-memoization), lint чист, / отвечает 200

Stage Summary:
- Каркас приложения полностью работает: авторизация (демо), шелл с навигацией, дашборд-референс
- API-клиент в src/lib/api.ts — КОНТРАКТ: эндпоинты из спецификации Task 2-a/2-b/2-c должны точно ему соответствовать
- Вью-заглушки tasks/budget/calendar/family ждут субагентов 4-a..4-d; дашборд уже использует api.tasks/events/transactions/budget.summary

---
Task ID: 2-c
Agent: general-purpose (API календаря и семьи)
Task: API-роуты календаря (/api/events) и семейных групп (/api/family) по спецификации, полный e2e-тест curl

Work Log:
- Изучены worklog, types.ts, dto.ts, api-helpers.ts, api.ts (контракт клиента), schema.prisma; eslint/tsconfig
- Написан src/app/api/events/route.ts: GET (from/to ISO, дефолт now-7д..now+45д, from>=to -> 400 «Некорректный диапазон дат»; личный контекст userId+groupId:null, групповой assertGroupAccess; пересечение start<to AND end>=from, orderBy start asc, include user) + POST (title reqString 1..200, end>start -> 400 «Окончание не может быть раньше начала», allDay Boolean, color из EVENT_COLORS иначе emerald, groupId -> assertGroupAccess)
- Написан src/app/api/events/[id]/route.ts: PATCH (частичное title/description/start/end/allDay/color, при смене start/end повторная проверка end>start) + DELETE, доступ: владелец события ИЛИ член группы события, иначе 404 «Событие не найдено»
- Написан src/app/api/family/route.ts: GET (группы по memberships, include members+user, createdAt asc) + POST (name 1..60, description<=300, inviteCode 6 символов из ABCDEFGHJKLMNPQRSTUVWXYZ23456789, до 5 попыток с проверкой уникальности, nested members create role owner)
- Написан src/app/api/family/join/route.ts: inviteCode trim+upper, 404 «Группа по этому коду не найдена», 409 «Вы уже состоите в этой группе», создание membership role member, возврат FamilyGroupDTO
- Написан src/app/api/family/leave/route.ts: 404 «Вы не состоите в этой группе»; не-владелец -> удаление membership; владелец с другими членами -> транзакция: передача роли owner и group.ownerId самому раннему (min createdAt) + удаление своей membership; владелец без членов -> удаление группы (каскад)
- Написан src/app/api/family/[id]/route.ts: DELETE только владелец, иначе 403 «Удалить группу может только владелец», 404 если группы нет
- E2E curl (демо-вход ТестСемья-2c + второй пользователь Б + Александр): POST события 201; GET диапазон/дефолты/400; PATCH (в т.ч. 400 при start>end по объединённым датам, 404 чужого id); DELETE 200/повтор 404; 401 без сессии; групповые события (создание членом 201, чтение видит и сид-события группы, 403 для не-члена, PATCH/DELETE чужого по группе события другим членом группы 200, 404 для не-члена); family: create 201 (код YNS6AY), GET, join своего кода 409, join demo24 в нижнем регистре 200, join неизвестного 404, leave не-владельцем ok, повтор leave 404, выход владельца с передачей владения Б, выход последнего владельца с удалением группы, DELETE группы не-владельцем 403 / владельцем ok / повтор 404
- Тестовые данные вычищены (события удалены, членства DEMO24 восстановлены, jar-файлы удалены); bun run lint — чисто; tsc --noEmit: ошибок в файлах 2-c нет (остались только предсуществующие examples/skills/seed.ts)

Stage Summary:
- Файлы: src/app/api/events/route.ts, src/app/api/events/[id]/route.ts, src/app/api/family/route.ts, src/app/api/family/join/route.ts, src/app/api/family/leave/route.ts, src/app/api/family/[id]/route.ts
- Все эндпоинты соответствуют контракту api.ts (api.events.*, api.family.*): пути, схемы DTO, {ok:true} для delete/leave
- Отклонений от спецификации нет; POST-создание возвращает 201 (клиент принимает любые 2xx)
- dev.log без ошибок моих роутов; lint чист

---
Task ID: 2-b
Agent: general-purpose (API бюджета)
Task: API транзакций и сводки бюджета — /api/transactions (GET, POST), /api/transactions/[id] (PATCH, DELETE), /api/budget/summary (GET) по спецификации, полный e2e-тест curl

Work Log:
- Изучены worklog, types.ts, dto.ts, api-helpers.ts, api.ts (контракт клиента), schema.prisma, seed.ts; eslint/tsconfig
- src/app/api/transactions/route.ts: GET (parseMonthParam + monthRange, дата gte start lt end; личный контекст = userId + groupId:null, групповой = assertGroupAccess + записи группы ВСЕХ членов; include user, сортировка date desc + createdAt desc, TransactionDTO[]) + POST (type 'income'|'expense' иначе 400 «Укажите тип операции»; amount numField 0.01..1000000000; category reqString 1..60; date через transactionDate; description optString 500; groupId при передаче -> assertGroupAccess, иначе null; 201 + TransactionDTO)
- src/app/api/transactions/[id]/route.ts: requireTransactionAccess (владелец ИЛИ член группы записи, иначе 404 «Запись не найдена») + PATCH (частичное type/amount/category/description/date с валидацией как в POST; пустой patch возвращает текущую запись) + DELETE ({ok:true}); Next 16 сигнатура params: Promise<{id:string}>
- src/app/api/budget/summary/route.ts: тот же скоуп, что GET /api/transactions; all транзакции месяца -> подсчёт в JS totalIncome/totalExpense/balance, byCategory (группировка по category+type, total desc), byDay на все 1..N дней месяца (N = new Date(Date.UTC(y, m, 0)).getUTCDate(), день из tx.date.getUTCDate(), нули включены); суммы округляются до копеек (round2) от шума Float
- Найдено и закрыто на краю тестов: JS скатывает «2026-02-31» в 3 марта — добавлена round-trip проверка (date.toISOString().slice(0,10) === input), теперь 400
- E2E curl (ТестБюджет-2b + демо-Александр + Анна): 401 без сессии; POST-валидация: без type 400, неверная дата 400, 2026-02-31 400, amount<0 400, без категории 400, чужой groupId 403; POST доход 50000 + расходы 3200.50/890/1500 -> 201; GET сентября: 4 записи, сортировка date desc + createdAt desc верна; GET августа [] ; month=abc -> дефолт текущий; PATCH amount 890->950 + description + date 09-12->09-14 + пустой body; PATCH 404/400/401; summary личный: income 50000, expense 5650.5, balance 44349.5, byCategory отсортирован по total desc, byDay ровно 30 дней (ненулевые 5/12/14/18, сумма по дням = тоталам); категория с 2 записями: count=2 total=3700.5; пустой месяц: byDay 31 нулевой; DELETE {ok:true}, повтор 404; групповой контекст: список группы видит записи Александра И Анны (5 шт, все groupId верен), сводка группы 12490 при income 0, личный список группы не пересекает; групповой POST 201 + DELETE cleanup; не-член: GET/summary группы 403, PATCH групповой записи 404; Анна (член) PATCH записи Александра 200 (возвращено 5400), DELETE личной записи Александра 404
- dev.log без ошибок моих роутов; bun run lint — чисто; tsc --noEmit: в моих файлах ошибок нет; временные jar-файлы удалены; тестовые данные: у ТестБюджет-2b осталось 4 транзакции сентября (плановый итог тест-сценария), групповые изменения откачены

Stage Summary:
- Файлы: src/app/api/transactions/route.ts, src/app/api/transactions/[id]/route.ts, src/app/api/budget/summary/route.ts
- Эндпоинты точно соответствуют контракту api.ts (api.transactions.list/create/update/remove, api.budget.summary): пути, схемы TransactionDTO/BudgetSummaryDTO, {ok:true} для DELETE
- Отклонения от спецификации: (1) POST возвращает 201 (клиент принимает любые 2xx); (2) дополнительная round-trip валидация дат вида 2026-02-31 (иначе JS молча записал бы 3 марта, ломая инвариант <date>T12:00:00Z); (3) суммы в summary округлены до копеек от Float-шума

---
Task ID: 2-a
Agent: general-purpose (API задач)
Task: API задач, напоминаний и уведомлений (GET/POST /api/tasks, PATCH/DELETE /api/tasks/[id], GET /api/reminders/due, GET/PATCH /api/notifications)

Work Log:
- Изучены worklog, types/dto/api-helpers/api-клиент, schema.prisma; подтверждён контракт src/lib/api.ts
- Написан src/app/api/tasks/route.ts: GET (status=all|todo|done|overdue, scope=personal|all|<groupId>, доступные задачи = личные created/assigned + задачи групп по FamilyMember, include reminder+assignee+createdBy, сортировка в JS: todo->done, deadline ASC nulls last, createdAt DESC) и POST (валидация title/priority/status/deadline/description, groupId через assertGroupAccess, assignee только в группе и только из её членов, reminder через nested create с валидацией всех 6 типов)
- Написан src/app/api/tasks/[id]/route.ts: PATCH (доступ создатель/исполнитель/член группы, иначе 404; частичное обновление; status done<->todo проставляет/снимает completedAt; reminder: нет поля — не трогать, null — удалить, объект — заменить delete+create; снятие deadline автоматически удаляет at_deadline/before; смена groupId с assertGroupAccess) и DELETE ({ok:true}, каскад)
- Написан src/app/api/reminders/due/route.ts — движок напоминаний: окно [max(lastFiredAt ?? now-2м, now-10м), now), расчёт fireMoment для at_deadline/before/daily/morning/weekly/once с tz-математикой (локальные календарные даты сегодня/вчера через UTC-поля сдвинутого момента, ISO-день недели для weekly), создание UserNotification + reminder.update lastFiredAt=now (для once ещё enabled=false), без дублей при повторных вызовах
- Написан src/app/api/notifications/route.ts: GET (unread=1, createdAt DESC, take 50) и PATCH (ids[] или all=true, только свои уведомления)
- curl-тесты (50+ сценариев, два пользователя ТестАПИ-2a/2b + группа «Группа теста 2a»): POST/GET/PATCH/DELETE задач, все фильтры и scope, все 400-валидации (title, enum, deadline, assignee вне группы, at_deadline без срока, before offset 1..43200, time HH:MM, weekly дни, once в будущем), 401/403/404, движок: daily/morning на текущей минуте, weekly только по дням недели (сегодня Вт=2 сработал, "3,5" — нет), at_deadline в момент срока, before за offset до срока, once сработал один раз и enabled=false, повторные вызовы без дублей, tz=abc/отсутствует -> 0, групповая задача срабатывает у опросившего первым члена группы, notifications list/unread/markRead(ids)/markRead(all)
- bunx tsc --noEmit: ошибок в моих файлах нет; bun run lint: чисто; dev.log: без ошибок (только prisma:query и 200/400/401/403/404)

Stage Summary:
- Созданы: src/app/api/tasks/route.ts, src/app/api/tasks/[id]/route.ts, src/app/api/reminders/due/route.ts, src/app/api/notifications/route.ts
- Все эндпоинты соответствуют клиенту src/lib/api.ts и DTO из src/lib/dto.ts; ответы через taskToDTO/notificationToDTO, ошибки {error} на русском
- Отклонения/уточнения: (1) title уведомления = 'Напоминание' без эмодзи (по правилу «никаких emoji в коде»); (2) для before без deadline сообщение «Для напоминания заранее нужен срок выполнения»; (3) при переносе групповой задачи в личные assigneeId очищается (инвариант «исполнитель только в группе»); (4) daysOfWeek принимает строку "1,3,5" или массив, нормализуется в отсортированную строку; (5) дедупликация lastFiredAt глобальна на напоминание (по схеме Reminder 1:1 Task) — уведомление получает тот член группы, кто опросил due первым
- Тестовые данные оставлены у пользователей testapi-2a/testapi-2b (демо-пользователь Александр не затронут)

---
Task ID: 2-a, 2-b, 2-c (сводка от главного агента)
Agent: main (Z.ai Code) — координация трёх параллельных субагентов
Task: API-слой целиком

Work Log:
- Task 2-a (задачи/напоминания/уведомления): /api/tasks (GET c фильтрами+scope, POST с валидацией reminder всех 6 типов), /api/tasks/[id] (PATCH с replace/remove reminder, DELETE), /api/reminders/due (движок с tz-математикой, окно 10 мин, дедупликация lastFiredAt, once→enabled=false), /api/notifications (GET/PATCH). Протестировано 50+ curl-сценариев.
- Task 2-b (бюджет): /api/transactions (GET месяц+scope, POST 201, PATCH/DELETE), /api/budget/summary (тоталы, byCategory, byDay все дни месяца, округление до копеек). Групповой контекст и права проверены.
- Task 2-c (календарь+семья): /api/events (GET пересечение диапазона, POST/PATCH/DELETE), /api/family (GET/POST с генерацией inviteCode), /api/family/join (404/409), /api/family/leave (передача владения/удаление), /api/family/[id] DELETE (owner only). Проверено на 3 сессиях.
- Исправлен тип upsertUser в src/lib/seed.ts (Promise<User>)
- В api.ts добавлен budget.aiAnalysis (POST /api/budget/ai-analysis → {analysis}) — эндпоинт реализует главный агент в Task 5

Stage Summary:
- Весь API-слой написан, протестирован curl-ом, lint чист, tsc по src/ без ошибок
- Согласовано: POST-создания возвращают 201 (клиент принимает любые 2xx); уведомления о напоминаниях без эмодзи в title
- Записи субагентов добавлены в этот worklog ниже/выше по хронологии

---
Task ID: 4-a
Agent: general-purpose (вью Задачи)
Task: Вью «Задачи» (src/components/views/tasks.tsx) с фильтрами + диалог задачи с конструктором гибких напоминаний (src/components/task-dialog.tsx)

Work Log:
- Изучены worklog, эталон dashboard.tsx, контракт api.ts, types.ts, format.ts, store.ts, app-shell.tsx, ui-компоненты (dialog/alert-dialog/select/tabs), валидации сервера /api/tasks
- views/tasks.tsx: заголовок («Задачи» + подпись «Личный контекст»/имя группы из ['family'] + кнопка «Новая задача»), Tabs-фильтр все/todo/overdue/done (grid 2×2 на мобиле), запрос useQuery(['tasks', filter, scope]) c scope=groupId??'personal', карточки-строки Card rounded-xl border p-4 hover:shadow-md: Checkbox-toggle статуса (мутация + invalidate ['tasks'] + toast при ошибке), title (line-through/muted при done), description line-clamp-1, чипы: приоритет (PRIORITY_CHIP_CLASSES/LABELS), дедлайн (Clock + relativeDay + fmtTime, rose при isOverdueTask), напоминание (BellRing + humanizeReminder + title-атрибут), исполнитель (UserRound + assigneeName), автор «от {createdByName}» если не текущий пользователь; действия Pencil (диалог) и Trash2 (AlertDialog «Удалить задачу?» / «Действие необратимо»); Skeleton-ы при загрузке; пустые состояния по фильтру (ListTodo/CheckCircle2 + текст + CTA «Создать задачу»); появление карточек — лёгкий framer-motion stagger
- task-dialog.tsx: Dialog sm:max-w-lg, форма (Enter-сабмит): название maxLength 200, описание textarea rows 2 maxLength 2000, срок datetime-local (ISO↔локальный через format(parseISO(iso),"yyyy-MM-dd'T'HH:mm") / new Date(v).toISOString(), бейдж «Необязательно»), приоритет Select, исполнитель Select («Не назначен»=sentinel 'none' + члены активной группы) ТОЛЬКО при groupId!==null, блок «Напоминание» (Separator + BellRing): 7 типов (none/at_deadline/before/daily/morning/weekly/once); before → Select пресетов 15/30/60/120/240/1440/2880/10080 (нестандартный офсет задачи добавляется динамической опцией); daily/morning → Input time (дефолты 09:00/08:00); weekly → 7 toggle-кнопок Пн..Вс (default/outline, aria-pressed, полные названия в aria-label) + time (дефолт 18:00); once → datetime-local; amber-подсказка «Укажите срок выполнения выше» для at_deadline/before без срока; live-строка текущей конфигурации (например «Напомним каждое утро в 08:00», «По Пн, Ср, Пт в 18:00»); футер: Отмена (ghost), Создать/Сохранить (Loader2, disabled при isPending), в редактировании слева Удалить (ghost text-destructive + AlertDialog)
- Реинициализация формы — key-паттерн: родитель хранит {open, task, nonce}, key={`${task?.id ?? 'new'}-${nonce}`} (nonce++ на каждое открытие — иначе повторное создание наследовало бы stale-состояние), внутри чистый useState(() => init) без useEffect/setState-in-effect
- Клиентская валидация перед сабмитом (toast.error): title непустой; at_deadline/before → deadline; before → offset; daily/morning → time; weekly → ≥1 день + time; once → fireAt в будущем; ошибки сервера (4xx) показываются его сообщением
- curl-проверка (демо-сессия Александра): фильтры all/todo/overdue/done с scope=personal (6/5/1/1 задач), POST с weekly "1,3,5"@18:30 → 201, PATCH replace на morning 07:45 + снятие deadline → 200, at_deadline без срока → 400 «Для напоминания в срок нужен срок выполнения», DELETE → 200 / повтор 404; тестовая задача удалена
- Проверки: GET / → 200; dev.log без ошибок компиляции; bun run lint — чисто; bunx tsc --noEmit — в src/components ошибок нет (только предсуществующие examples/skills)

Stage Summary:
- Файлы: src/components/views/tasks.tsx (перезаписана заглушка), src/components/task-dialog.tsx (новый); другие файлы не тронуты
- Конструктор напоминаний покрывает все 6 типов сервера, состояние формы полностью восстанавливается при редактировании (напоминания с enabled=false трактуются как «Без напоминания»), assigneeId отправляется только в групповом контексте, reminder:null корректно удаляет напоминание при PATCH
- Стиль соответствует эталону dashboard.tsx: rounded-xl border shadow-sm, чипы приоритетов, Skeleton/пустые состояния, тосты sonner, инвалидация ['tasks'], без emoji, весь текст на русском

---
Task ID: 4-d
Agent: general-purpose (вью Семья)
Task: Вью «Семья» (src/components/views/family.tsx) — создание групп, вход по коду приглашения, управление участниками и группами

Work Log:
- Изучены worklog (спецификация), эталон dashboard.tsx, контракт api.family (list/create/join/leave/remove), FamilyGroupDTO/FamilyMemberDTO, format.ts (initials/fmtDate/plural), store.ts (groupId/setGroupId), app-shell.tsx (GroupSwitcher)
- Перезаписана заглушка family.tsx целиком (один файл, все диалоги внутри): 'use client', без react-hook-form/useEffect/useMemo/any (под ограничения React Compiler)
- Заголовок «Семейные группы» + подпись; блок действий ВСЕГДА сверху (grid sm:grid-cols-2): карточка «Создать группу» (форма с name/описанием, maxLength 60/300, кнопка disabled при пустом имени или isPending, Loader2) и «Присоединиться по коду» (uppercase-фильтр A-Z0-9, maxLength 6, font-mono text-center text-lg tracking-wide, кнопка disabled при <6 символов)
- Список групп (grid md:grid-cols-2): карточка = иконка Users в bg-primary/10, имя + Badge «Активна» + Badge «N участников» (через plural()) + «создана {fmtDate}», описание, блок кода приглашения (tracking-[0.3em], Copy → clipboard + toast «Код скопирован», иконка Copy→Check на 2 сек), участники (Separator; Avatar size-7 c initials, «(вы)» для текущего, Crown amber для владельца), действия (Separator; «Сделать активной» → setGroupId + toast.success(`Переключено на «...»`) / disabled «Активная группа», «Выйти», «Удалить» только для владельца)
- AlertDialog выхода с умным текстом (владелец: передача владения/удаление; участник: потеря доступа); AlertDialog удаления (destructive-кнопка); после leave/remove: invalidate ['family'] + при выходе из активной группы setGroupId(null) + invalidate ['tasks']/['transactions']/['summary']/['events']
- Ошибки сервера (404/409/валидация) — toast.error(e.message) из ApiRequestError; скелетоны при загрузке; пустое состояние с Users size-12; состояние ошибки с кнопкой «Повторить»
- Текущий пользователь определяется по session.user.id (надёжнее email; id гарантированно в сессии по next-auth.d.ts), владельцы — по group.ownerId === id
- Проверки: GET / → 200; dev.log без error/⨯; bun run lint — чисто; bunx tsc --noEmit — ошибок в src/components нет (только предсуществующие examples/skills)

Stage Summary:
- Файл: src/components/views/family.tsx (единственный изменённый)
- Полный CRUD сценариев семьи: создание группы, вступление по коду, переключение активного контекста (синхронно с GroupSwitcher через queryKey ['family']), выход (с передачей владения на бэке), удаление; инвалидация связанных выборок при смене контекста
- Все данные через api.family.* по контракту; стиль соответствует эталону dashboard.tsx (rounded-xl border shadow-sm, text-2xl заголовок, size-4.5 иконки карточек, пустые состояния с иконкой)

---
Task ID: 4-c
Agent: general-purpose (вью Календарь)
Task: Вью «Календарь» — месячная сетка с событиями и маркерами дедлайнов задач + диалог создания/редактирования события

Work Log:
- Изучены worklog, эталон dashboard.tsx, контракт api.ts (api.events/api.tasks/api.family), types.ts, format.ts, store.ts, ui-компоненты (dialog, alert-dialog, switch, button), globals.css (токены цветов), API /api/events
- Написан src/components/event-dialog.tsx: экспорт EVENT_COLOR_CLASSES (полные статические классы chip/dot/hex по спецификации), форма (название maxLength 200, описание Textarea rows 2, Switch «Весь день», начало/окончание type date|datetime-local, 6 круглых кнопок цвета через style backgroundColor hex + ring у выбранной), инициализация useState(() => getInitialValues(...)) под key-паттерн родителя (edit — из ISO события, new — defaultDate/сегодня 18:00–19:00; allDay хранится как дата T00:00/T23:59 локально), переключение allDay конвертирует значения формата, валидация (название, даты, end<=start → toast «Окончание не быть раньше начала»), save через api.events.create/update с groupId из useAppStore, Loader2 на кнопках, удаление через AlertDialog «Удалить событие?» + api.events.remove, invalidateQueries ['events']
- Написан src/components/views/calendar.tsx: заголовок «Календарь» + контекст (Личные/группа из api.family.list по groupId) + кнопка «Событие» (диалог на сегодня); панель месяца ChevronLeft/заголовок format(anchor,'LLLL yyyy',{locale:ru}) capitalize/ChevronRight + «Сегодня»; сетка 7×N (startOfWeek/endOfWeek weekStartsOn:1) в Card p-2 sm:p-4 — ячейки div (клик → создание на эту дату) min-h-[84px]/sm:min-h-[112px] border rounded-lg hover:bg-accent/40, чужие дни opacity-40, сегодня — bg-primary круг; чипы событий (button, EVENT_COLOR_CLASSES chip, stopPropagation → редактирование, текст `HH:mm название`/`название` при allDay) до 3 + «Ещё N»; многосуточные события раскладываются на каждый покрываемый день (граница полуночи — конец в 00:00 не занимает следующий день, как в Google Calendar); чип дедлайна задачи (первая todo-задача дня из api.tasks.list({status:'todo',scope})) «Задача: …» amber; легенда (6 точек цветов + «Событие», amber-квадратик + «Дедлайн задачи»); Skeleton-сетка при загрузке; лёгкий framer-motion fade/slide; key-паттерн EventDialog + сброс editing/pendingDate при закрытии (фикс устаревшей формы при повторном открытии того же дня)
- Отклонение от буквы спецификации: у кнопки «Удалить» класс text-destructive вместо text-destructive-foreground — токена --destructive-foreground в теме проекта нет (кнопочный destructive-вариант использует text-white), класс бы просто не сгенерировался
- Проверки: curl / → 200; dev.log — только ✓ Compiled, ошибок моих файлов нет; bun run lint — чисто; bunx tsc --noEmit — в src/components ошибок нет; смоук curl от имени свежего демо-пользователя: POST timed (Z-ISO из datetime-local) 201, POST allDay (T00:00/T23:59) 201, PATCH полным payload 200, POST end<start → 400 «Окончание не может быть раньше начала» (клиентский тост идентичен), DELETE {ok:true} ×2, тестовые события удалены

Stage Summary:
- Файлы: src/components/views/calendar.tsx (перезаписана заглушка), src/components/event-dialog.tsx (новый, экспортирует EVENT_COLOR_CLASSES)
- Реализовано: месячная сетка с навигацией, чипы событий по цветам, маркеры дедлайнов, легенда, скелетоны; диалог создания/редактирования/удаления события с валидацией, allDay-режимом и выбором цвета; контекст Личные/группа; все запросы через контракт api.ts, инвалидация ['events']
- Другие файлы не тронуты; lint и tsc чистые, страница отвечает 200

---
Task ID: 4-b
Agent: general-purpose (вью Бюджет)
Task: Вью «Бюджет» — таблица транзакций месяца, сводка, графики recharts, ИИ-анализ покупок; диалог записи

Work Log:
- Изучены worklog, ЭТАЛОН views/dashboard.tsx, контракт src/lib/api.ts, types.ts, categories.ts, format.ts, store.ts, ui-компоненты (dialog/alert-dialog/table/badge/card/button), eslint/tsconfig/next.config
- Написан src/components/transaction-dialog.tsx: контролируемая форма без react-hook-form (тип — две большие кнопки-переключателя Расход/Доход с rose/emerald-рамками, сброс категории при смене типа; сумма number; категория — сетка чипов из EXPENSE/INCOME_CATEGORIES с chipClass выбранного; описание опц.; дата type=date, default сегодня), валидация toast'ом «Заполните сумму, категорию и дату», create/update с groupId из стора, инвалидация ['transactions'] и ['summary'], Loader2 на сабмите
- Написан src/components/views/budget.tsx (перезаписана заглушка): заголовок с контекстом группы (api.family.list), кнопки «ИИ-анализ покупок» (secondary, Sparkles, disabled при totalExpense===0 с title-подсказкой) и «Запись»; навигация месяца ChevronLeft/ChevronRight + monthTitle с заглавной буквой + «Сегодня»; сводка grid-cols-3 (Доходы/Расходы/Баланс с тонами emerald/rose, Skeleton при загрузке)
- Графики (только при totalExpense>0): PieChart-donut col-span-2 (топ-7 категорий + «Прочее», палитра 8 цветов, innerRadius 55/outerRadius 80, кастомный Tooltip с fmtMoney, легенда строками с цветными точками) + AreaChart col-span-3 по byDay (XAxis ticks каждые ~3 дня, Area expense stroke #f43f5e fill #f43f5e33, YAxis fmtMoneyShort, кастомный Tooltip «5 октября / Расходы: …»), ResponsiveContainer
- Таблица «Операции за месяц» (Badge с количеством): скролл max-h-480 sticky thead (обход overflow-x-auto обёртки shadcn Table через [&>div]:overflow-visible — проверено по скомпилированному CSS), колонки Дата/Категория(чип)/Описание(sm+)/Кто(только в группе, md+, initials-аватар)/Сумма(+/−)/действия (Pencil → диалог, Trash2 → AlertDialog «Удалить запись?»); скелетоны при загрузке, пустое состояние с кнопкой
- ИИ-анализ: useMutation api.budget.aiAnalysis, диалог sm:max-w-2xl с markdown-рендером (react-markdown, кастомные компоненты h1-h3/p/ul/ol/li/strong), состояние загрузки (Loader2 + «до минуты…»), при ошибке — toast «ИИ-анализ временно недоступен» + fallback с «Повторить» (UI не падает, эндпоинт может отсутствовать)
- Проверки: GET / → 200; dev.log без ошибок и без стектрейсов моих файлов; bun run lint — чисто; bunx tsc --noEmit — в src/components ошибок нет (остались только предсуществующие examples/skills)

Stage Summary:
- Файлы: src/components/views/budget.tsx (перезаписана), src/components/transaction-dialog.tsx (новый). Другие файлы не тронуты
- Реализовано по спецификации: сводка месяца, донат-диаграмма категорий, динамика расходов, таблица с edit/delete и групповым контекстом, диалог добавления/редактирования записи, ИИ-анализ с устойчивостью к отсутствию эндпоинта
- Инвалидации по префиксу ['transactions'] / ['summary'] — обновляют и дашборд; queryKey ['family'] переиспользован с GroupSwitcher (без дублей запросов)

---
Task ID: 5
Agent: main (Z.ai Code)
Task: ИИ-анализ бюджета (LLM) + интеграция + полировка

Work Log:
- Изучен LLM skill (z-ai-web-dev-sdk, backend-only)
- Создан POST /api/budget/ai-analysis: сбор транзакций месяца (личный/групповой скоуп), компактная сериализация, промпт финансового аналитика на русском, структура «Краткие итоги / Куда уходят деньги / Что бросается в глаза / Рекомендации», ответ {analysis: markdown}
- Проверен curl-ом: реальный ответ LLM по демо-данным с корректными суммами и процентами
- Полировка: убран emoji из сида (welcome-уведомление), мелкие фиксы

Stage Summary:
- Эндпоинт полностью работает и подключён к кнопке «ИИ-анализ покупок» в вью Бюджет (диалог с react-markdown)

---
Task ID: 6
Agent: main (Z.ai Code)
Task: E2E-верификация (agent-browser), фиксы, стабилизация dev-сервера

Work Log:
- E2E через agent-browser: экран авторизации (кнопка Яндекс disabled без ключей + подсказка) — ок
- НАЙДЕН И ИСПРАВЛЕН БАГ: signIn('demo', {name: undefined}) сериализовался в строку "undefined" → создавался пользователь «undefined». Фикс: name передаётся только если непуст. Лишний пользователь удалён из БД
- Демо-вход → дашборд: приветствие «Доброй ночи, Александр!», статы (баланс 67 280 ₽, +99 000/−31 720), задачи на сегодня, просроченные, события, последние траты — ок
- Вью Задачи: фильтры-табы, карточки с приоритетами/дедлайнами (Сегодня/Завтра/Вчера)/напоминаниями (человекочитаемыми), чекбокс завершения, создание задачи с ежедневным напоминанием 10:30, редактирование, удаление — ок
- Переключатель контекста Личные ↔ «Наша семья»: списки/бюджет корректно фильтруются — ок
- Бюджет: сводка группы (−12 490 ₽), donut по категориям, area-динамика, таблица со sticky-шапкой, создание транзакции (1250 ₽ Продукты) и удаление — ок
- ИИ-анализ в UI: диалог, спиннер, markdown с заголовками, разбор по членам семьи (Александр 6 900 / Анна 5 590) — ок
- Календарь: сетка месяца, события с цветами, «Задача:»-маркеры дедлайнов, создание события с выбором цвета — ок
- Семья: карточка группы, код DEMO24 + копирование, участники с ролями (Владелец/Участник), создание группы «Родители», вход по коду с ошибкой 409 («Вы уже состоите»), удаление группы — ок
- Уведомления: колокольчик, список, «Прочитать все», бейдж непрочитанных — ок
- Тёмная тема, мобильный вид 390×844 (нижняя навигация, сайдбар скрыт, футер прижат и не перекрыт fixed-nav), 0 ошибок консоли браузера
- Акцидент: при тесте удаления транзакции кликнул не ту строку — восстановил сид-запись «Фрукты и овощи» (1200 ₽, Анна), тестовую запись удалил
- Dev-сервер дважды погибал: причина 1 — OOM (Turbopack + headless Chrome > 4 ГБ), причина 2 — sandbox убивает процессы-потомки bash-сессии. Решение: запуск через bun spawn(detached)+unref (двойной fork) — сервер стабилен между сессиями
- Финал: lint чист, tsc по src/ чист, dev.log без ошибок, все страницы 200

Stage Summary:
- Приложение полностью E2E-верифицировано в реальном браузере: авторизация → все 5 разделов → CRUD → ИИ-анализ → уведомления → темы → адаптивность
- Единственный код-фикс: сериализация undefined в credentials-логине демо
- Проект готов к использованию

---
Task ID: 6
Agent: main (Z.ai Code)
Task: Определить внешний хост приложения для формы регистрации Яндекс OAuth (redirect URI / «Хост страницы, на которой разместится кнопка или виджет авторизации»)

Work Log:
- Из dev.log найдена подсказка: `Cross origin request detected from preview-chat-1654056a-757b-40b9-87ba-be22c12f0672.space-z.ai` — внешний домен предпросмотра.
- curl подтвердил: `https://preview-chat-1654056a-757b-40b9-87ba-be22c12f0672.space-z.ai/` отдаёт приложение (HTTP 200), домен по container-id (c-6abc969a-...space-z.ai) — 410.
- Обнаружено: сервер за шлюзом видит Host как внутренний `http://ws-ccd-cf-eafe-gyxnvjltdu.cn-hongkong-vpc.fcapp.run` → без NEXTAUTH_URL NextAuth формировал бы OAuth-ссылки на неверный хост.
- В `.env` добавлены: `NEXTAUTH_URL=https://preview-chat-1654056a-757b-40b9-87ba-be22c12f0672.space-z.ai`, `NEXTAUTH_SECRET=<сгенерирован>`, пустые `YANDEX_CLIENT_ID/SECRET`.
- Создан `src/app/api/oauth-setup/route.ts`: возвращает `{ host (NEXTAUTH_URL|Host-заголовок), serverOrigin, yandexConfigured }`, пишет внешние хосты в host-capture.log.
- В `src/components/auth-screen.tsx` добавлен блок «Данные для формы Яндекс OAuth»: текущий хост (window.location.origin) и Redirect URI `{origin}/api/auth/callback/yandex` с кнопками копирования + предупреждение при несовпадении origin и NEXTAUTH_URL.
- В `next.config.ts` добавлен `allowedDevOrigins` с доменом предпросмотра (убирает cross-origin warning для HMR).
- Проверки: lint — чисто; agent-browser: блок рендерится, копирование работает (toast), warning-логика работает; через внешний домен `/` → 200, `/api/oauth-setup` → host = preview-chat домен.

Stage Summary:
- Внешний хост приложения: `https://preview-chat-1654056a-757b-40b9-87ba-be22c12f0672.space-z.ai`
- Redirect URI для Яндекс OAuth: `https://preview-chat-1654056a-757b-40b9-87ba-be22c12f0672.space-z.ai/api/auth/callback/yandex`
- NEXTAUTH_URL уже указывает на внешний домен — после заполнения YANDEX_CLIENT_ID/SECRET в .env Яндекс-вход заработает без доп. настроек.
- Блок с хостом и Redirect URI теперь виден на экране входа (пока Yandex не настроен), значения копируются одной кнопкой.

---
Task ID: 7
Agent: main (Z.ai Code)
Task: Настройка безопасной передачи секретов Яндекс OAuth — файл заполняет владелец сам, ассистенту читать .env.local запрещено

Work Log:
- Пользователь запретил передавать секреты через чат и читать файл с ними; файл .env в его файловом менеджере не виден (dotfile).
- `.env` перезаписан: только DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET (пустые YANDEX_* убраны).
- Создан `.env.local` — шаблон с пустыми YANDEX_CLIENT_ID/YANDEX_CLIENT_SECRET и комментариями. С этого момента ассистент файл НЕ читает; проверка настроенности — только через булев флаг.
- `src/app/api/oauth-setup/route.ts`: добавлен POST — принимает {clientId, clientSecret}, санитизирует (без пробелов, 16–200 символов, [A-Za-z0-9_.-]), обновляет ТОЛЬКО строки YANDEX_* в .env.local (остальное сохраняет), значения никогда не возвращает и не логирует. GET дополнен флагом yandexConfigured.
- `src/components/auth-screen.tsx`: в блок «Данные для формы Яндекс OAuth» добавлена форма вставки ключей (ClientID + ClientSecret с переключателем видимости). После сохранения — поллинг /api/auth/providers до появления yandex, затем тост «Готово» и активация кнопки входа. При настроенных ключах — компактный режим со статусом и свёрнутой формой «Изменить ключи».
- Тесты с фиктивными ключами (32 hex): POST → dev.log показал «Reload env: .env.local» (Next.js сам подхватывает файл, полный рестарт не нужен) → провайдер yandex активировался с callbackUrl = https://preview-chat-...space-z.ai/api/auth/callback/yandex. Форма в браузере: сохранение → поллинг → тост успеха; валидация мусора отрабатывает (400 + понятная ошибка). После тестов .env.local сброшен в пустой шаблон (реальных секретов в нём не было).
- Итоговое состояние: yandexConfigured=false, форма видна, кнопка Яндекса ожидает ключи. Внешний домен: GET / → 200, host отдаётся корректно.

Stage Summary:
- Секреты Яндекс OAuth хранятся ТОЛЬКО в `/home/z/my-project/.env.local` (скрытый файл, нужно включить показ скрытых файлов).
- Два способа заполнения: (1) вручную в файле, (2) через форму на экране входа — значения идут из браузера пользователя напрямую в файл, минуя чат и ассистента.
- Next.js в dev-режиме автоматически подхватывает изменения .env.local («Reload env»), кнопка «Войти через Яндекс ID» активируется сама через несколько секунд после сохранения.
- После реального заполнения ключей ассистенту читать .env.local запрещено; статус проверяется только через GET /api/oauth-setup → yandexConfigured (булево значение).

---
Task ID: 8
Agent: main (Z.ai Code)
Task: Починить вход через Яндекс ID — вместо формы Яндекса открывалась встроенная страница NextAuth «Sign in with Yandex» (CSRF-ошибка)

Work Log:
- Разбор скриншота пользователя (VLM): показана стандартная страница NextAuth /api/auth/signin, не форма Яндекса.
- dev.log показал цепочку: POST /api/auth/signin/yandex → 302 → GET /api/auth/signin?csrf=true — падает CSRF-проверка next-auth v4.24.13 (подтверждено по исходникам core/index.js: без csrfTokenVerified редирект на signin?csrf=true).
- curl через внешний домен с куками: поток сервера полностью рабочий — ключи заполнены, redirect_uri корректный, отдаётся url на oauth.yandex.ru/authorize. Проблема только в браузере.
- Причины: (1) панель предпросмотра — кросс-доменный iframe, куки NextAuth SameSite=Lax в нём не отправляются → CSRF fail; (2) oauth.yandex.ru отдаёт X-Frame-Options: DENY + frame-ancestors 'self' — страницы Яндекса нельзя рендерить в iframe.
- Также найдена и исправлена ошибка next.config: allowedDevOrigins с полным URL (https://...) включал BLOCK-режим и блокировал /_next/* с домена предпросмотра (сравнение идёт по голому hostname; проверено тестами isCsrfOriginAllowed). Исправлено на голый hostname + *.space-z.ai.
- auth.ts: все куки NextAuth переведены на SameSite=None (для https/NEXTAUTH_URL), secure-префиксы имён сохранены (__Secure-/__Host-).
- auth-screen.tsx: кнопка «Войти через Яндекс ID» в iframe открывает попап-окно /?auth=yandex (в топ-уровне — прежний signIn). В попапе — авто-старт signIn с callbackUrl /?from=auth-popup. Листенер postMessage 'lifebalance:auth-success' → location.replace('/?authed=1'). Демо-вход в попапе тоже получает маркер from=auth-popup. Фолбэк-подсказка при ?authed=1 без сессии (браузер блокирует куки — открыть в новой вкладке).
- page.tsx: эффект завершения попапа — при session + window.opener + from=auth-popup: postMessage родителю (targetOrigin = свой origin) + history.replaceState('/') + window.close(). Отказ от window.name (Chrome очищает его при кросс-доменной навигации).
- Тесты (agent-browser + кросс-сайт iframe 127.0.0.1:9999 → внешний домен): демо-вход в iframe работает (SameSite=None); клик по кнопке Яндекса в iframe открывает попап → авто-редирект на настоящий passport.yandex.ru (client_id и redirect_uri верные); полный цикл попапа проверен через демо-вход в попапе: попап сам закрылся, родитель перезагрузился и отрисовал дашборд со всеми данными. Блокировок /_next/* в логах больше нет.

Stage Summary:
- Вход через Яндекс ID в панели предпросмотра: кнопка открывает отдельное окно с формой Яндекса (Яндекс запрещает iframe), после авторизации окно закрывается, панель перезагружается с сессией.
- Демо-вход прямо в панели тоже работает (куки SameSite=None).
- Альтернативный путь — «Открыть в новой вкладке»: там обычный вход без попапа.
- Фолбэк: если браузер жёстко блокирует сторонние куки (Safari), показывается подсказка открыть приложение в отдельной вкладке.
