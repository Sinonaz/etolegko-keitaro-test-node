import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { KeitaroModule } from './keitaro/keitaro.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('mongodbUri') ??
          'mongodb://localhost:27017/keitaro',
      }),
    }),
    HealthModule,
    KeitaroModule,
  ],
})
export class AppModule {}
