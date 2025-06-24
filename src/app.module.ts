import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProcessDataController } from './controller/process-data.controller';
import { ProcessDataService } from './service/process-data.service';
import { PagarmeService } from './service/pagarme.service';
import { HttpModule } from '@nestjs/axios';
import {
  User,
  UserSchema,
  Payment,
  PaymentSchema,
  Message,
  MessageSchema,
} from './schema/schemas';
import { SendMessage, SendMessageSchema } from './schema/send-message.schema';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookController } from './controller/webhook.controller';
import { ProcessWebHookService } from './service/process-webhook.service';
import { GlobalExceptionFilter } from './exception/GlobalExceptionFilter';
import { SendMessageService } from './service/send-message.service';
import { AssistentModule } from './assistent/assistent.module';
import { HealthCheckController } from './controller/health-check.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AssistentModule, // Importando o módulo assistente
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Message.name, schema: MessageSchema },
      { name: SendMessage.name, schema: SendMessageSchema },
    ]),
    HttpModule,
  ],
  controllers: [ProcessDataController, WebhookController, HealthCheckController],
  providers: [ProcessDataService, PagarmeService, ProcessWebHookService, SendMessageService , 
  {
    provide: APP_FILTER,
    useClass: GlobalExceptionFilter,
  },],
})
export class AppModule {}
