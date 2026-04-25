import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TunnelSession } from '../../schema/tunnel-session.schema';
import { IMessageSender, MESSAGE_SENDER } from '../../common/messaging/messaging.interface';
import { generateTag } from '../../common/utils/tag-generator';

const TUNNEL_DURATION_HOURS = 24;
const TUNNEL_MESSAGE_LIMIT = 15;

// Tag fixa usada pelo destinatário para identificar o remetente anônimo
const RECIPIENT_SENDER_TAG = 'admirador';

@Injectable()
export class TunnelService {
  private readonly logger = new Logger(TunnelService.name);

  constructor(
    @InjectModel(TunnelSession.name)
    private readonly tunnelModel: Model<TunnelSession>,
    @Inject(MESSAGE_SENDER)
    private readonly messageSender: IMessageSender,
  ) {}

  async open(senderPhone: string, recipientPhone: string, recipientName: string, senderName: string): Promise<void> {
    const tag = await this.generateUniqueTag(senderPhone, recipientName);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TUNNEL_DURATION_HOURS);

    await this.tunnelModel.create({
      senderPhone,
      recipientPhone,
      senderName,
      status: 'ACTIVE',
      messagesRemaining: TUNNEL_MESSAGE_LIMIT,
      expiresAt,
      tag,
    });

    this.logger.log(`Túnel aberto entre ${senderPhone} e ${recipientPhone} com tag #${tag}`);

    await this.messageSender.send(
      senderPhone,
      `💌 Seu admirado aceitou entrar no túnel!\n\n` +
      `Você tem ${TUNNEL_MESSAGE_LIMIT} mensagens para enviar.\n\n` +
      `Para falar com ele(a), comece sua mensagem com *#${tag}*\n` +
      `Exemplo: #${tag} Oi, sou eu! 😊`,
    );

    await this.messageSender.send(
      recipientPhone,
      `✨ Túnel aberto! Aguarde a mensagem do seu admirador secreto...\n\n` +
      `Para responder, comece sua mensagem com *#${RECIPIENT_SENDER_TAG}*\n` +
      `Exemplo: #${RECIPIENT_SENDER_TAG} Que surpresa! 💬`,
    );
  }

  async findActiveSession(phone: string): Promise<TunnelSession | null> {
    const now = new Date();
    return this.tunnelModel.findOne({
      $or: [{ senderPhone: phone }, { recipientPhone: phone }],
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    }).exec();
  }

  async findSessionByTag(phone: string, tag: string): Promise<TunnelSession | null> {
    const now = new Date();
    const normalizedTag = tag.toLowerCase();

    // Tenta como remetente (o remetente usa a tag do destinatário)
    const asSender = await this.tunnelModel.findOne({
      senderPhone: phone,
      tag: normalizedTag,
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    }).exec();

    if (asSender) return asSender;

    // Tenta como destinatário (o destinatário usa a tag fixa "admirador")
    if (normalizedTag === RECIPIENT_SENDER_TAG) {
      return this.tunnelModel.findOne({
        recipientPhone: phone,
        status: 'ACTIVE',
        expiresAt: { $gt: now },
      }).exec();
    }

    return null;
  }

  async findAllActiveSessions(phone: string): Promise<TunnelSession[]> {
    const now = new Date();
    return this.tunnelModel.find({
      $or: [{ senderPhone: phone }, { recipientPhone: phone }],
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    }).exec();
  }

  async relay(session: TunnelSession, fromPhone: string, message: string): Promise<void> {
    const isSender = session.senderPhone === fromPhone;

    if (isSender) {
      await this.relaySenderMessage(session, message);
    } else {
      await this.relayRecipientMessage(session, message);
    }
  }

  private async relaySenderMessage(session: TunnelSession, message: string): Promise<void> {
    const remaining = session.messagesRemaining - 1;

    await this.tunnelModel.findByIdAndUpdate(session._id, {
      messagesRemaining: remaining,
      ...(remaining === 0 && { status: 'DONE' }),
    });

    if (remaining > 0) {
      await this.messageSender.send(
        session.recipientPhone,
        `_Admirador_: ${message}\n\nRestam ${remaining} mensagens — agora é sua vez...\n` +
        `(Responda com *#${RECIPIENT_SENDER_TAG}* para ele(a) te ouvir)`,
      );

      await this.messageSender.send(
        session.senderPhone,
        `✓ Mensagem enviada! Restam *${remaining}* mensagens no túnel. Aguarde a resposta.`,
      );
    } else {
      await this.messageSender.send(
        session.recipientPhone,
        `_Admirador_: ${message}`,
      );

      await this.messageSender.send(
        session.senderPhone,
        `✓ Última mensagem enviada! O túnel será encerrado.`,
      );

      await this.closeTunnel(session);
    }
  }

  private async relayRecipientMessage(session: TunnelSession, message: string): Promise<void> {
    await this.messageSender.send(
      session.senderPhone,
      `_${session.senderName}_: ${message}`,
    );

    await this.messageSender.send(
      session.recipientPhone,
      `✓ Mensagem enviada!`,
    );
  }

  private async closeTunnel(session: TunnelSession): Promise<void> {
    this.logger.log(`Túnel encerrado entre ${session.senderPhone} e ${session.recipientPhone}`);

    const closeMessage =
      `💫 O túnel chegou ao fim!\n\n` +
      `Foi uma experiência única, não foi? Continue enviando mensagens anônimas pelo CatChat:\n` +
      `catchat.com.br`;

    await this.messageSender.send(session.senderPhone, closeMessage);
    await this.messageSender.send(session.recipientPhone, closeMessage);
  }

  @Cron('0 * * * *')
  async expireActiveSessions(): Promise<void> {
    const now = new Date();
    const expired = await this.tunnelModel.find({
      status: 'ACTIVE',
      expiresAt: { $lte: now },
    }).exec();

    for (const session of expired) {
      await this.expireSession(session);
    }
  }

  async expireSession(session: TunnelSession): Promise<void> {
    await this.tunnelModel.findByIdAndUpdate(session._id, { status: 'DONE' });

    const expiredMessage =
      `⏰ O túnel expirou após ${TUNNEL_DURATION_HOURS}h de inatividade.\n\n` +
      `Acesse o CatChat para uma nova experiência:\ncatchat.com.br`;

    await this.messageSender.send(session.senderPhone, expiredMessage);
    await this.messageSender.send(session.recipientPhone, expiredMessage);
  }

  private async generateUniqueTag(senderPhone: string, recipientName: string): Promise<string> {
    const existingSessions = await this.tunnelModel.find({
      senderPhone,
      status: 'ACTIVE',
    }).select('tag').exec();

    const existingTags = existingSessions.map((s) => s.tag);
    return generateTag(recipientName, existingTags);
  }
}
