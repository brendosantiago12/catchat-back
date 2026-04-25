import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RecipientState = 'WAITING_READ' | 'WAITING_TUNNEL' | 'TUNNEL_ACTIVE' | 'DONE';
export type ProductType = 'MESSAGE_ONLY' | 'MESSAGE_TUNNEL' | 'UNLIMITED';

@Schema({ timestamps: true })
export class SendMessage extends Document {
  @Prop({ required: true })
  senderName: string;

  @Prop({ required: true })
  senderPhone: string;

  @Prop({ required: true })
  senderMessage: string;

  @Prop({ required: true })
  recipientName: string;

  @Prop({ required: true })
  recipientPhone: string;

  @Prop({ required: false, default: false })
  status: boolean;

  @Prop({ required: false, default: 'WAITING_READ' })
  recipientState: RecipientState;

  @Prop({ required: true })
  productType: ProductType;
}

export const SendMessageSchema = SchemaFactory.createForClass(SendMessage);
