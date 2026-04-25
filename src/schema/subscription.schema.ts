import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED';

@Schema({ timestamps: true })
export class Subscription extends Document {
  @Prop({ required: true })
  userPhone: string;

  @Prop({ required: true, default: 'ACTIVE' })
  status: SubscriptionStatus;

  @Prop({ required: true })
  expiresAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

SubscriptionSchema.index({ userPhone: 1, status: 1 });
SubscriptionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
