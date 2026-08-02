import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'productor@test.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Productor123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
