import { Global, Module } from '@nestjs/common';
import { KeitaroClient } from './keitaro.client';
import { KeitaroController } from './keitaro.controller';

@Global()
@Module({
  controllers: [KeitaroController],
  providers: [KeitaroClient],
  exports: [KeitaroClient],
})
export class KeitaroModule {}
