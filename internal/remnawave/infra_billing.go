package remnawave

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// InfraBillingProviderShort — провайдер во вложенных объектах.
type InfraBillingProviderShort struct {
	UUID        uuid.UUID `json:"uuid"`
	Name        string    `json:"name"`
	FaviconLink string    `json:"faviconLink"`
	LoginURL    string    `json:"loginUrl"`
}

// InfraBillingNodeShort — нода во вложенных объектах.
type InfraBillingNodeShort struct {
	UUID        uuid.UUID `json:"uuid"`
	Name        string    `json:"name"`
	CountryCode string    `json:"countryCode"`
}

// InfraBillingBillingNode — строка списка оплачиваемых нод.
type InfraBillingBillingNode struct {
	UUID          uuid.UUID                 `json:"uuid"`
	NodeUUID      uuid.UUID                 `json:"nodeUuid"`
	ProviderUUID  uuid.UUID                 `json:"providerUuid"`
	NextBillingAt time.Time                 `json:"nextBillingAt"`
	CreatedAt     time.Time                 `json:"createdAt"`
	UpdatedAt     time.Time                 `json:"updatedAt"`
	Provider      InfraBillingProviderShort `json:"provider"`
	Node          InfraBillingNodeShort     `json:"node"`
}

// InfraBillingNodesStats — сводка в ответе /nodes.
type InfraBillingNodesStats struct {
	UpcomingNodesCount   int     `json:"upcomingNodesCount"`
	CurrentMonthPayments int     `json:"currentMonthPayments"`
	TotalSpent           float64 `json:"totalSpent"`
}

// InfraBillingAvailableNode — нода без привязки к биллингу (можно добавить).
type InfraBillingAvailableNode struct {
	UUID        uuid.UUID `json:"uuid"`
	Name        string    `json:"name"`
	CountryCode string    `json:"countryCode"`
}

// InfraBillingNodesBody — тело response для GET /api/infra-billing/nodes.
type InfraBillingNodesBody struct {
	TotalBillingNodes          int                         `json:"totalBillingNodes"`
	TotalAvailableBillingNodes int                         `json:"totalAvailableBillingNodes"`
	BillingNodes               []InfraBillingBillingNode   `json:"billingNodes"`
	AvailableBillingNodes      []InfraBillingAvailableNode `json:"availableBillingNodes"`
	Stats                      InfraBillingNodesStats      `json:"stats"`
}

// UpdateInfraBillingNodeRequest — PATCH /api/infra-billing/nodes.
type UpdateInfraBillingNodeRequest struct {
	UUIDs         []uuid.UUID `json:"uuids"`
	NextBillingAt time.Time   `json:"nextBillingAt"`
}

// CreateInfraBillingNodeRequest — POST /api/infra-billing/nodes.
type CreateInfraBillingNodeRequest struct {
	ProviderUUID  uuid.UUID  `json:"providerUuid"`
	NodeUUID      uuid.UUID  `json:"nodeUuid"`
	NextBillingAt *time.Time `json:"nextBillingAt,omitempty"`
}

// CreateInfraProviderRequest — POST /api/infra-billing/providers.
type CreateInfraProviderRequest struct {
	Name        string  `json:"name"`
	FaviconLink *string `json:"faviconLink,omitempty"`
	LoginURL    *string `json:"loginUrl,omitempty"`
}

// UpdateInfraProviderRequest — PATCH /api/infra-billing/providers.
type UpdateInfraProviderRequest struct {
	UUID        uuid.UUID `json:"uuid"`
	Name        *string   `json:"name,omitempty"`
	FaviconLink *string   `json:"faviconLink,omitempty"`
	LoginURL    *string   `json:"loginUrl,omitempty"`
}

// CreateInfraBillingHistoryRequest — POST /api/infra-billing/history.
type CreateInfraBillingHistoryRequest struct {
	ProviderUUID uuid.UUID `json:"providerUuid"`
	Amount       float64   `json:"amount"`
	BilledAt     time.Time `json:"billedAt"`
}

// InfraBillingHistoryRecord — запись истории оплат провайдерам.
type InfraBillingHistoryRecord struct {
	UUID         uuid.UUID                 `json:"uuid"`
	ProviderUUID uuid.UUID                 `json:"providerUuid"`
	Amount       float64                   `json:"amount"`
	BilledAt     time.Time                 `json:"billedAt"`
	Provider     InfraBillingProviderShort `json:"provider"`
}

// InfraBillingHistoryBody — тело response для GET /api/infra-billing/history.
type InfraBillingHistoryBody struct {
	Records []InfraBillingHistoryRecord `json:"records"`
	Total   int                         `json:"total"`
}

// InfraBillingProviderNode — нода в карточке провайдера.
type InfraBillingProviderNode struct {
	NodeUUID    uuid.UUID `json:"nodeUuid"`
	Name        string    `json:"name"`
	CountryCode string    `json:"countryCode"`
}

// InfraBillingProviderHistoryAgg — агрегат по истории у провайдера.
type InfraBillingProviderHistoryAgg struct {
	TotalAmount float64 `json:"totalAmount"`
	TotalBills  int     `json:"totalBills"`
}

// InfraBillingProviderItem — провайдер в списке /providers.
type InfraBillingProviderItem struct {
	UUID           uuid.UUID                      `json:"uuid"`
	Name           string                         `json:"name"`
	FaviconLink    string                         `json:"faviconLink"`
	LoginURL       string                         `json:"loginUrl"`
	CreatedAt      time.Time                      `json:"createdAt"`
	UpdatedAt      time.Time                      `json:"updatedAt"`
	BillingHistory InfraBillingProviderHistoryAgg `json:"billingHistory"`
	BillingNodes   []InfraBillingProviderNode     `json:"billingNodes"`
}

// InfraBillingProvidersBody — тело response для GET /api/infra-billing/providers.
type InfraBillingProvidersBody struct {
	Total     int                        `json:"total"`
	Providers []InfraBillingProviderItem `json:"providers"`
}

// GetInfraBillingNodes GET /api/infra-billing/nodes.
func (r *Client) GetInfraBillingNodes(ctx context.Context) (*InfraBillingNodesBody, error) {
	var resp apiResponse[InfraBillingNodesBody]
	if err := r.doJSON(ctx, http.MethodGet, "/api/infra-billing/nodes", nil, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// GetInfraBillingHistory GET /api/infra-billing/history?start=&size=.
func (r *Client) GetInfraBillingHistory(ctx context.Context, start, size int) (*InfraBillingHistoryBody, error) {
	path := fmt.Sprintf("/api/infra-billing/history?start=%d&size=%d", start, size)
	var resp apiResponse[InfraBillingHistoryBody]
	if err := r.doJSON(ctx, http.MethodGet, path, nil, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// GetInfraBillingProviders GET /api/infra-billing/providers.
func (r *Client) GetInfraBillingProviders(ctx context.Context) (*InfraBillingProvidersBody, error) {
	var resp apiResponse[InfraBillingProvidersBody]
	if err := r.doJSON(ctx, http.MethodGet, "/api/infra-billing/providers", nil, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// PatchInfraBillingNodes PATCH /api/infra-billing/nodes (смена nextBillingAt).
func (r *Client) PatchInfraBillingNodes(ctx context.Context, req UpdateInfraBillingNodeRequest) (*InfraBillingNodesBody, error) {
	var resp apiResponse[InfraBillingNodesBody]
	if err := r.doJSON(ctx, http.MethodPatch, "/api/infra-billing/nodes", req, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// CreateInfraBillingNode POST /api/infra-billing/nodes.
func (r *Client) CreateInfraBillingNode(ctx context.Context, req CreateInfraBillingNodeRequest) (*InfraBillingNodesBody, error) {
	var resp apiResponse[InfraBillingNodesBody]
	if err := r.doJSON(ctx, http.MethodPost, "/api/infra-billing/nodes", req, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// DeleteInfraBillingNode DELETE /api/infra-billing/nodes/{uuid}.
func (r *Client) DeleteInfraBillingNode(ctx context.Context, billingUUID uuid.UUID) (*InfraBillingNodesBody, error) {
	path := fmt.Sprintf("/api/infra-billing/nodes/%s", billingUUID.String())
	var resp apiResponse[InfraBillingNodesBody]
	if err := r.doJSON(ctx, http.MethodDelete, path, nil, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// CreateInfraProvider POST /api/infra-billing/providers.
func (r *Client) CreateInfraProvider(ctx context.Context, req CreateInfraProviderRequest) (*InfraBillingProviderItem, error) {
	var resp apiResponse[InfraBillingProviderItem]
	if err := r.doJSON(ctx, http.MethodPost, "/api/infra-billing/providers", req, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// PatchInfraProvider PATCH /api/infra-billing/providers.
func (r *Client) PatchInfraProvider(ctx context.Context, req UpdateInfraProviderRequest) (*InfraBillingProviderItem, error) {
	var resp apiResponse[InfraBillingProviderItem]
	if err := r.doJSON(ctx, http.MethodPatch, "/api/infra-billing/providers", req, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// DeleteInfraProvider DELETE /api/infra-billing/providers/{uuid}.
func (r *Client) DeleteInfraProvider(ctx context.Context, providerUUID uuid.UUID) error {
	path := fmt.Sprintf("/api/infra-billing/providers/%s", providerUUID.String())
	return r.doJSON(ctx, http.MethodDelete, path, nil, nil)
}

// CreateInfraBillingHistory POST /api/infra-billing/history.
func (r *Client) CreateInfraBillingHistory(ctx context.Context, req CreateInfraBillingHistoryRequest) (*InfraBillingHistoryBody, error) {
	var resp apiResponse[InfraBillingHistoryBody]
	if err := r.doJSON(ctx, http.MethodPost, "/api/infra-billing/history", req, &resp); err != nil {
		return nil, err
	}
	return &resp.Response, nil
}

// DeleteInfraBillingHistory DELETE /api/infra-billing/history/{uuid}.
func (r *Client) DeleteInfraBillingHistory(ctx context.Context, recordUUID uuid.UUID) error {
	path := fmt.Sprintf("/api/infra-billing/history/%s", recordUUID.String())
	return r.doJSON(ctx, http.MethodDelete, path, nil, nil)
}
