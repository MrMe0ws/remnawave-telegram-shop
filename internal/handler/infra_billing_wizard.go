package handler

import (
	"sync"

	"github.com/google/uuid"
)

type infraWizKind uint8

const (
	infraWizNone infraWizKind = iota
	infraWizNodeNextDate
	infraWizNodeAwaitNode  // выбран провайдер, ждём выбор свободной ноды
	infraWizNodeCreateDate // выбрана нода, ждём дату в тексте
	infraWizHistAmount
	infraWizHistDate
	infraWizProvCreateName
	infraWizProvCreateFavicon
	infraWizProvCreateLogin
	infraWizProvEditName
	infraWizProvEditFavicon
	infraWizProvEditLogin
)

// infraWizState — пошаговый ввод админа для инфра-биллинга (текстом в чат).
type infraWizState struct {
	Kind             infraWizKind
	BillingUUID      uuid.UUID
	ProviderUUID     uuid.UUID
	NodeUUID         uuid.UUID
	ProvEditUUID     uuid.UUID
	DraftName        string
	DraftFavicon     string
	HistDraftAmount  float64
	HistAmountFilled bool
}

var infraWizMu sync.Mutex
var infraWizByAdmin = make(map[int64]infraWizState)

func InfraBillingWizardWaiting(adminID int64) bool {
	infraWizMu.Lock()
	defer infraWizMu.Unlock()
	s, ok := infraWizByAdmin[adminID]
	return ok && s.Kind != infraWizNone
}

func infraWizClear(adminID int64) {
	infraWizMu.Lock()
	delete(infraWizByAdmin, adminID)
	infraWizMu.Unlock()
}

func infraWizSet(adminID int64, s infraWizState) {
	infraWizMu.Lock()
	defer infraWizMu.Unlock()
	if s.Kind == infraWizNone {
		delete(infraWizByAdmin, adminID)
		return
	}
	infraWizByAdmin[adminID] = s
}

func infraWizGet(adminID int64) (infraWizState, bool) {
	infraWizMu.Lock()
	defer infraWizMu.Unlock()
	s, ok := infraWizByAdmin[adminID]
	if !ok || s.Kind == infraWizNone {
		return infraWizState{}, false
	}
	return s, true
}
