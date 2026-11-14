import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  KYC_DOCUMENT_TYPES,
  KYC_PURPOSES,
  type KycDocumentType,
  type KycPurpose,
} from '../kyc.types';

const isIdUpload = (dto: UploadUrlDto) => dto.purpose === 'kycId';

export class UploadUrlDto {
  @IsIn(KYC_PURPOSES)
  purpose!: KycPurpose;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ValidateIf(isIdUpload)
  @IsIn(KYC_DOCUMENT_TYPES)
  documentType?: KycDocumentType;

  @ValidateIf(isIdUpload)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 -]{3,31}$/, {
    message: 'idNumber must be 4 to 32 letters, digits, spaces or hyphens',
  })
  idNumber?: string;
}

export class CompleteUploadDto {
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'checksum must be a 64 character SHA-256 hex digest',
  })
  checksum!: string;
}

/** Accepts no properties: any supplied field is rejected as unknown. */
export class EmptyBodyDto {}
