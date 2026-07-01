const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3001/api';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';

export async function sendWhatsAppMessage(phone: string, text: string) {
  try {
    const formattedPhone = phone.replace(/\D/g, '') + '@c.us';

    // Using global fetch (Node 18+)
    const response = await fetch(`${WAHA_URL}/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: WAHA_SESSION,
        chatId: formattedPhone,
        text: text,
      }),
    });

    if (!response.ok) {
      console.error('Falha ao enviar WAHA message:', await response.text());
    }
  } catch (error) {
    console.error('Erro na integracao WAHA:', error);
  }
}
