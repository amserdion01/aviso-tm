import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from '../auth/public.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Public: the login screen lists the demo accounts before authentication.
  @Public()
  @Get()
  findAll() {
    return this.users.findAll();
  }
}
