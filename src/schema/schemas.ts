import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

//USER SCHEMA
@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  nome: string;

  @Prop({ required: true })
  celular: string;

  @Prop({ required: false })
  email: string;

  @Prop({ required: true })
  taxId: string;

  @Prop({ required: true })
  rate_limit: number;

  @Prop({ default: () => uuidv4() })
  user_id: string;

}

export const UserSchema = SchemaFactory.createForClass(User);

//PAYMENT SCHEMA
@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ required: true })
  user_id: string;

  @Prop({ required: true })
  id_compra: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  expiresAt: string;

  @Prop({ required: true })
  qrCode: string;

  @Prop({ required: true })
  qrCodeUrl: string;

  @Prop({ required: true })
  status: string;

}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

//MESSAGE SCHEMA
@Schema({ timestamps: true })
export class Message extends Document {

  @Prop({ default: () => uuidv4() })  //gerador de id
  id_mensagem: string;

  @Prop({ required: true })
  id_user: string;

  @Prop({ required: true })
  userName: string;

  @Prop({ required: true })
  numeroRemetente: string;

  @Prop({ required: true })
  nomeDestinario: string;

  @Prop({ required: true })
  numeroDestinario: string;

  @Prop({ required: true })
  mensagem: string;

  @Prop({ required: true })
  status_message: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);