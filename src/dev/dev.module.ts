import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeedController } from './seed.controller';
import { User, UserSchema, Payment, PaymentSchema, Message, MessageSchema } from '../schema/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [SeedController],
})
export class DevModule {}
