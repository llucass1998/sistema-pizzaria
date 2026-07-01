import { randomUUID } from 'crypto';

export interface PaymentIntent {
  provider: string;
  externalId: string;
  paymentUrl: string;
}

export class PaymentGatewayService {
  /**
   * Cria um link de pagamento. No ambiente atual, geramos um link mock.
   * Em produção, isso bateria na API do Stripe / MercadoPago.
   */
  static async createPaymentLink(
    orderId: string,
    amount: number,
    _tenantId: string,
    _customerName: string,
    _customerEmail?: string
  ): Promise<PaymentIntent> {
    const provider = process.env.PAYMENT_GATEWAY || 'MOCK';
    const externalId = `pay_${randomUUID().replace(/-/g, '')}`;
    
    // Como não estamos armazenando os dados de cartão localmente (PCI DSS Compliance),
    // sempre retornamos uma URL hospedada pelo próprio gateway.
    let paymentUrl = '';

    if (provider === 'STRIPE') {
      // paymentUrl = await stripe.checkout.sessions.create(...)
      paymentUrl = `https://checkout.stripe.com/mock/${externalId}?order=${orderId}`;
    } else if (provider === 'MERCADOPAGO') {
      // paymentUrl = await mercadopago.preferences.create(...)
      paymentUrl = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${externalId}`;
    } else {
      // MOCK
      const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
      paymentUrl = `${baseUrl}/mock-payment?orderId=${orderId}&externalId=${externalId}&amount=${amount}`;
    }

    return {
      provider,
      externalId,
      paymentUrl,
    };
  }
}
