import { WhatsAppService } from '../services/whatsapp.service.js';

export async function sendWhatsAppMessage(phone: string, text: string) {
  await WhatsAppService.sendMessage(phone, text);
}
