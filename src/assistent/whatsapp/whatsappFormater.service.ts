import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsappFormatter {
  public cleanPhoneNumber(input: string): string {
    const onlyNumbers = input.replace(/\D/g, '');
    return onlyNumbers.substring(2);
  }

  public formatPhoneNumber(number: string): string {
    // Remove qualquer caractere não numérico
    let n = number.replace(/\D/g, '');

    // Garante DDI 55
    if (!n.startsWith('55')) {
      n = '55' + n;
    }

    // Neste ponto o número tem: 55 + DDD(2) + 9? + 8 dígitos
    // Se tiver 13 dígitos (55 + DDD + 9 + 8), remove o 9 extra (índice 4)
    if (n.length === 13 && n[4] === '9') {
      n = n.slice(0, 4) + n.slice(5);
    }

    return n + '@c.us';
  }

  public parsePhoneNumber(waNumber: string): string {
    let number = waNumber.replace('@c.us', '');
    number = '+' + number;

    return number.slice(0, 5) + '9' + number.slice(5);
  }
}
