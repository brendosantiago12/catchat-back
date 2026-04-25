import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { BotStateService } from './whatsapp/bot-state.service';
import { ConversationService } from './conversation/conversation.service';
import { AiService } from './ai/ai.service';
import { WhatsappSessionStoreService } from './whatsapp/whatsappSessionStore';
import { WhatsappFormatter } from './whatsapp/whatsappFormater.service';
import { QrControllerController } from './whatsapp/qr-controller.controller';
import { MESSAGE_SENDER } from '../common/messaging/messaging.interface';
import { MessageGuardHook } from './pre-hooks/message-guard.hook';
import { RateLimitHook } from './pre-hooks/rate-limit.hook';
import { DebounceHook } from './pre-hooks/debounce.hook';
import { TunnelHook } from './pre-hooks/tunnel.hook';
import { ClassificationHook } from './pre-hooks/classification.hook';
import { MessagePipelineService } from './pre-hooks/message-pipeline.service';
import { MessageDeliveryService } from './services/message-delivery.service';
import { TunnelService } from './services/tunnel.service';
import {
  UserConversationModel,
  UserConversationSchema,
} from './conversation/conversation.schema';
import { SendMessage, SendMessageSchema } from '../schema/send-message.schema';
import { TunnelSession, TunnelSessionSchema } from '../schema/tunnel-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserConversationModel.name, schema: UserConversationSchema },
      { name: SendMessage.name, schema: SendMessageSchema },
      { name: TunnelSession.name, schema: TunnelSessionSchema },
    ]),
    ConfigModule,
  ],
  providers: [
    BotStateService,
    WhatsappService,
    WhatsappSessionStoreService,
    WhatsappFormatter,
    ConversationService,
    AiService,
    MessageGuardHook,
    RateLimitHook,
    DebounceHook,
    TunnelHook,
    ClassificationHook,
    MessageDeliveryService,
    TunnelService,
    MessagePipelineService,
    {
      provide: MESSAGE_SENDER,
      useExisting: WhatsappService,
    },
  ],
  controllers: [QrControllerController],
  exports: [AiService, WhatsappService, MESSAGE_SENDER, MessageDeliveryService, WhatsappFormatter],
})
export class AssistentModule {}
