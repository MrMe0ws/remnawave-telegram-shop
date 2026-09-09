---
name: api-contract-validator
description: >-
  Проверяет соответствие типов между TypeScript-клиентом (фронтенд) и Go-сервером.
  Ловит рассинхрон: бэк изменил формат ответа, фронт не обновил тип, приложение
  падает. Обязателен перед любым git push, если меняются API-сигнатуры.
---

# Валидатор API-контракта

Когда бэк и фронт живут отдельно, контракт между ними часто расходится:
бэк добавил поле в JSON, фронт этого не знает, тип на фронте неправильный,
и где-то падает при разборе JSON. Или наоборот: фронт требует поля, которого
нет в бэке.

## Когда применять

- Любая правка Go-обработчиков, которые отдают JSON
  (функции в `internal/api`, `internal/handler`).
- Любая правка TypeScript-типов в `web/cabinet/src/lib/api.ts` и компонентах.
- Перед git push, если меняются типы запросов или ответов API.
- Не нужно для правок других частей фронта, локализации, стилей.

## Порядок

### 1. Найти все Go-структуры, которые идут в JSON

```bash
# Поиск структур с json-тегами
grep -r "json:" internal/ --include="*.go" | grep "type " -B 2

# Или: поиск функций-обработчиков
grep -r "w.Header().Set.*json" internal/ --include="*.go"
grep -r "json.NewEncoder(w)" internal/ --include="*.go"
```

Выписать структуры вроде:

```go
type PaymentStatusResponse struct {
    CheckoutID  int       `json:"checkout_id"`
    Status      string    `json:"status"`
    Amount      float64   `json:"amount"`
    Currency    string    `json:"currency"`
    PaidAt      time.Time `json:"paid_at"`
}
```

### 2. Найти все TypeScript-типы для этих структур

В `web/cabinet/src/lib/api.ts` должны быть интерфейсы:

```typescript
interface PaymentStatusResponse {
  checkout_id: number
  status: string
  amount: number
  currency: string
  paid_at: string  // ISO 8601 дата
}
```

Проверить:
- Поле есть в обоих (Go и TS)
- Тип совпадает (int ↔ number, string ↔ string, time.Time ↔ string)
- json-тег в Go совпадает с ключом в TS

### 3. Сверить все поля

| Go-структура | JSON-тег | TS-тип | Совпадает? |
|---|---|---|---|
| `CheckoutID int` | `checkout_id` | `checkout_id: number` | ✓ |
| `PaidAt time.Time` | `paid_at` | `paid_at: string` | ✓ |
| (новое) | — | — | ✗ |

Проблемы:
- **Поле только в Go** → возможно, оно не нужно в ответе. Или TS просто забыл.
- **Поле только в TS** → TS ждёт это поле, но бэк его не отдаёт. Может привести к `undefined`.
- **Тип не совпадает** → Go отдаёт строку, TS ждёт число. JSON.parse() упадёт.

### 4. Проверить null/undefined

Go:

```go
type PaymentStatusResponse struct {
    ExtraHwid *int `json:"extra_hwid,omitempty"`  // может быть null
}
```

TS должна отразить это:

```typescript
interface PaymentStatusResponse {
    extra_hwid?: number  // опционально
}
```

Если поле `omitempty` в Go, оно должно быть `?` в TS (или явно `| null`).

### 5. Проверить сложные типы

Если Go возвращает массив или объект:

```go
type ListResponse struct {
    Items []PaymentStatusResponse `json:"items"`
    Total int                    `json:"total"`
}
```

TS должна совпадать:

```typescript
interface ListResponse {
    items: PaymentStatusResponse[]
    total: number
}
```

### 6. Проверить перечисления (enum)

Если статус может быть только "paid" / "pending" / "failed":

Go (иногда):

```go
type PaymentStatus string
const (
    StatusPaid    PaymentStatus = "paid"
    StatusPending PaymentStatus = "pending"
    StatusFailed  PaymentStatus = "failed"
)
```

TS должна это отразить:

```typescript
type PaymentStatus = "paid" | "pending" | "failed"
```

Или хотя бы комментарий: `status: string // "paid" | "pending" | "failed"`

### 7. Запросы в обратную сторону

Если фронт отправляет POST-тело:

Go:

```go
type CreatePaymentRequest struct {
    Amount   float64 `json:"amount"`
    Currency string  `json:"currency"`
    Tariff   int     `json:"tariff_id"`
}
```

TS:

```typescript
interface CreatePaymentRequest {
    amount: number
    currency: string
    tariff_id: number  // ← проверить json-тег!
}
```

### 8. Контрольный список

- [ ] Все Go-структуры с json-тегами найдены
- [ ] Все TS-интерфейсы найдены и соответствуют Go
- [ ] Нет полей, которые есть в Go, но забыты в TS
- [ ] Нет полей в TS, которых бэк не отдаёт
- [ ] Типы совпадают (int→number, string→string, time.Time→string)
- [ ] Опциональные поля отмечены `?` в TS и `omitempty` в Go
- [ ] Сложные типы (массивы, объекты) правильно отражены
- [ ] Перечисления и enum задокументированы или типизированы

### 9. Рассказать честно

В ответе писать:
- Какие структуры проверены
- Найденные рассинхроны и как их чинить
- Если контракт полностью совпадает, сказать "✓ контракт в порядке"
- Если что-то не совпадает, явно написать, что нужно исправить (в каком файле, какую строку)
