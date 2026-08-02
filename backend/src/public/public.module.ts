import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicLotesService } from './public-lotes.service';

@Module({
  controllers: [PublicController],
  providers: [PublicLotesService],
})
export class PublicModule {}
