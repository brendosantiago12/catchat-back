import { IsString, IsEmail, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class UserDataDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsNotEmpty()
  celular: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  taxId: string;
}

export class FormDataDto {
  @IsString()
  @IsNotEmpty()
  nomeDestinario: string;

  @IsString()
  @IsNotEmpty()
  numeroDestinario: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  mensagem: string;
}

export class PayloadDto {
  @ValidateNested()
  @Type(() => UserDataDto)
  userData: UserDataDto;

  @ValidateNested()
  @Type(() => FormDataDto)
  formData: FormDataDto;
}

export class QrCodeResponseDto {
  id_mensagem: string;
  //id_compra: string
  brCode: string;
  brCodeBase64: string;
}

export class AbacatePayStatusResponseDto {
  status: string;
  expiresAt: string;
}

export class PixResponseDto {
  id: string;
  amount: string;
  status: string;
  expiresAt: string;
  qrCode: string;
  qrCodeUrl: string;
}

export class HomePhoneDto {
  phone: string;
  countryCode: string;
  area:string;
}