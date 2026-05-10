package platega

import (
	"context"
	"fmt"
	"strings"

	"remnawave-tg-shop-bot/internal/database"
)

type Provider struct {
	client        *Client
	invoiceType   database.InvoiceType
	paymentMethod PaymentMethod
}

func (p *Provider) InvoiceType() database.InvoiceType {
	return p.invoiceType
}

func (p *Provider) IsConfigured() bool {
	return p.client != nil && p.client.IsConfigured()
}

func (p *Provider) CreateInvoice(
	ctx context.Context,
	purchaseID int64,
	amount float64,
	currency string,
	description string,
	returnURL string,
	username string,
) (redirectURL string, transactionID string, err error) {
	if p.client == nil {
		return "", "", fmt.Errorf("platega client not configured")
	}
	u := strings.ReplaceAll(strings.ReplaceAll(username, "&", ""), "=", "")
	payload := fmt.Sprintf("purchaseId=%d", purchaseID)
	if u != "" {
		payload += "&username=" + u
	}

	resp, err := p.client.CreateTransaction(ctx, &CreateTransactionRequest{
		PaymentMethod: p.paymentMethod,
		PaymentDetails: PaymentDetails{
			Amount:   amount,
			Currency: currency,
		},
		Description: description,
		Return:      returnURL,
		FailedUrl:   returnURL,
		Payload:     payload,
	})
	if err != nil {
		return "", "", fmt.Errorf("create platega transaction: %w", err)
	}

	return resp.Redirect, resp.TransactionId, nil
}

var invoiceTypeToMethod = map[database.InvoiceType]PaymentMethod{
	database.InvoiceTypePlategaSBP:       PaymentMethodSBPQR,
	database.InvoiceTypePlategaCards:     PaymentMethodCardAcquiring, // 11 — в актуальном API нет отдельного кода «карты РФ» (раньше ошибочно использовали 10)
	database.InvoiceTypePlategaAcquiring: PaymentMethodCardAcquiring,
	database.InvoiceTypePlategaWorldwide: PaymentMethodInternationalAcquiring,
	database.InvoiceTypePlategaCrypto:    PaymentMethodCrypto,
}

func ProviderFor(client *Client, invoiceType database.InvoiceType) (*Provider, error) {
	method, ok := invoiceTypeToMethod[invoiceType]
	if !ok {
		return nil, fmt.Errorf("unsupported platega invoice type: %s", invoiceType)
	}
	return &Provider{
		client:        client,
		invoiceType:   invoiceType,
		paymentMethod: method,
	}, nil
}
