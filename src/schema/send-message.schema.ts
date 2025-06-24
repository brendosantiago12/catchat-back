import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
}

export const SendMessageSchema = SchemaFactory.createForClass(SendMessage);
