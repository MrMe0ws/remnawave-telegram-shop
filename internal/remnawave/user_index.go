package remnawave

import (
	"context"
	"fmt"
	"strings"

	"remnawave-tg-shop-bot/utils"
)

// UserIndex — снимок пользователей панели для массовых операций.
//
// FindUserForAdminCustomer резолвит одного клиента и в худшем случае тянет
// весь список панели ради каждого. Для операции над сотней клиентов это сотня
// выгрузок; здесь список забирается один раз, а сопоставление идёт локально
// в том же порядке приоритетов: telegram id -> сгенерированный username ->
// префикс username по customer id -> ссылка на подписку.
type UserIndex struct {
	users      []User
	byTelegram map[int64][]int
	byUsername map[string]int
	bySubLink  map[string]int
	byIDPrefix map[string]int
	totalUsers int
}

// BuildUserIndex выгружает пользователей панели один раз и строит индексы.
func (r *Client) BuildUserIndex(ctx context.Context) (*UserIndex, error) {
	if r == nil {
		return nil, fmt.Errorf("remnawave client not configured")
	}
	users, err := r.GetUsers(ctx)
	if err != nil {
		return nil, err
	}
	ix := &UserIndex{
		users:      users,
		byTelegram: make(map[int64][]int, len(users)),
		byUsername: make(map[string]int, len(users)),
		bySubLink:  make(map[string]int, len(users)),
		byIDPrefix: make(map[string]int, len(users)),
		totalUsers: len(users),
	}
	for i := range users {
		if users[i].TelegramID != nil {
			tid := *users[i].TelegramID
			ix.byTelegram[tid] = append(ix.byTelegram[tid], i)
		}
		uname := strings.TrimSpace(users[i].Username)
		if uname != "" {
			lower := strings.ToLower(uname)
			if _, dup := ix.byUsername[lower]; !dup {
				ix.byUsername[lower] = i
			}
			// Префикс "<customerID>_" — как в findExistingUserForCustomer для
			// синтетических telegram id (web-only клиенты).
			if pos := strings.Index(uname, "_"); pos > 0 {
				prefix := uname[:pos]
				if _, dup := ix.byIDPrefix[prefix]; !dup {
					ix.byIDPrefix[prefix] = i
				}
			}
		}
		if link := strings.TrimSpace(users[i].SubscriptionUrl); link != "" {
			if _, dup := ix.bySubLink[link]; !dup {
				ix.bySubLink[link] = i
			}
		}
	}
	return ix, nil
}

// Total — сколько профилей в снимке.
func (ix *UserIndex) Total() int {
	if ix == nil {
		return 0
	}
	return ix.totalUsers
}

// Find возвращает профиль панели для клиента магазина либо nil.
// Порядок совпадает с FindUserForAdminCustomer, чтобы массовая операция
// работала ровно с тем же профилем, что и одиночные админские действия.
func (ix *UserIndex) Find(customerID int64, telegramID int64, subscriptionLink *string, isWebOnly bool) *User {
	if ix == nil {
		return nil
	}

	if !isWebOnly && !utils.IsSyntheticTelegramID(telegramID) {
		if idxs := ix.byTelegram[telegramID]; len(idxs) > 0 {
			suffix := fmt.Sprintf("_%d", telegramID)
			for _, i := range idxs {
				if strings.Contains(ix.users[i].Username, suffix) {
					return &ix.users[i]
				}
			}
			return &ix.users[idxs[0]]
		}
	}

	if i, ok := ix.byUsername[strings.ToLower(generateUsername(customerID, telegramID))]; ok {
		return &ix.users[i]
	}

	if utils.IsSyntheticTelegramID(telegramID) {
		if i, ok := ix.byIDPrefix[fmt.Sprintf("%d", customerID)]; ok {
			return &ix.users[i]
		}
	}

	if subscriptionLink != nil {
		if link := strings.TrimSpace(*subscriptionLink); link != "" {
			if i, ok := ix.bySubLink[link]; ok {
				return &ix.users[i]
			}
		}
	}

	if idxs := ix.byTelegram[telegramID]; len(idxs) > 0 {
		return &ix.users[idxs[0]]
	}
	return nil
}
