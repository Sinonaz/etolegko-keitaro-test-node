import { IsInt, Min } from 'class-validator';

export class AddOfferDto {
  @IsInt()
  @Min(1)
  offer_id!: number;
}
