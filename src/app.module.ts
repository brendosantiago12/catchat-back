import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { ProcessDataController } from './controller/process-data.controller';
import { ProcessDataService } from './service/process-data.service';
import { PagarmeService } from './service/pagarme.service';
import { ProcessWebHookService } from './service/process-webhook.service';
import { SendMessageService } from './service/send-message.service';
import { OtpService } from './service/otp.service';
import { GlobalExceptionFilter } from './exception/GlobalExceptionFilter';
import { AssistentModule } from './assistent/assistent.module';
import { DevModule } from './dev/dev.module';
import { HealthCheckController } from './controller/health-check.controller';
import { WebhookController } from './controller/webhook.controller';
import { SubscriptionController } from './controller/subscription.controller';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    AssistentModule,
    ...(process.env.NODE_ENV === 'development' ? [DevModule] : []),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    HttpModule,
  ],
  controllers: [ProcessDataController, WebhookController, HealthCheckController, SubscriptionController],
  providers: [
    ProcessDataService,
    PagarmeService,
    ProcessWebHookService,
    SendMessageService,
    OtpService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
