import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Adresă de email invalidă.' })
  @MaxLength(200)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Introdu parola.' })
  @MaxLength(200)
  parola: string;
}
