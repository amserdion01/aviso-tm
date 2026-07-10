import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Adresă de email invalidă.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Introdu parola.' })
  parola: string;
}
