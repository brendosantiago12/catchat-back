import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type TunnelStatus = 'ACTIVE' | 'DONE';

@Schema({ timestamps: true })
export class TunnelSession extends Document {
  @Prop({ default: () => uuidv4() })
  tunnelId: string;

  @Prop({ required: true })
  senderPhone: string;

  @Prop({ required: true })
  recipientPhone: string;

  @Prop({ required: true, default: 'ACTIVE' })
  status: TunnelStatus;

  @Prop({ required: true, default: 15 })
  messagesRemaining: number;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ required: true })
  senderName: string;

  @Prop({ required: true })
  tag: string;
}

export const TunnelSessionSchema = SchemaFactory.createForClass(TunnelSession);

TunnelSessionSchema.index({ senderPhone: 1, tag: 1 });
TunnelSessionSchema.index({ recipientPhone: 1, tag: 1 });
TunnelSessionSchema.index({ senderPhone: 1, status: 1 });
TunnelSessionSchema.index({ recipientPhone: 1, status: 1 });
TunnelSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
