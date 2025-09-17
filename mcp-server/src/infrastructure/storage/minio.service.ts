/**
 * MinIO Storage Service - Infrastructure Layer
 * Service for storing large data like screenshots in MinIO object storage
 */

import { Client as MinIOClient } from 'minio';
import type { ILogger } from '../../core/interfaces/logger.interface.js';
import { Result } from '../../core/result.js';

export interface MinIOConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
}

export interface StorageResult {
  url: string;
  bucket: string;
  key: string;
  size: number;
  etag?: string;
}

export interface IMinIOService {
  /**
   * Store a buffer in MinIO
   */
  store(key: string, buffer: Buffer, metadata?: Record<string, string>): Promise<Result<StorageResult, Error>>;

  /**
   * Get a pre-signed URL for accessing an object
   */
  getSignedUrl(key: string, expiry?: number): Promise<Result<string, Error>>;

  /**
   * Delete an object from storage
   */
  delete(key: string): Promise<Result<void, Error>>;

  /**
   * Check if bucket exists and is accessible
   */
  checkConnection(): Promise<Result<boolean, Error>>;
}

export class MinIOService implements IMinIOService {
  private client: MinIOClient;
  private bucket: string;

  constructor(
    private readonly config: MinIOConfig,
    private readonly logger: ILogger
  ) {
    this.client = new MinIOClient({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey
    });
    this.bucket = config.bucket;
  }

  async store(
    key: string, 
    buffer: Buffer, 
    metadata?: Record<string, string>
  ): Promise<Result<StorageResult, Error>> {
    try {
      // Ensure bucket exists
      const bucketExists = await this.client.bucketExists(this.bucket);
      if (!bucketExists) {
        await this.client.makeBucket(this.bucket, this.config.region || 'us-east-1');
        this.logger.info({ bucket: this.bucket }, 'Created MinIO bucket');
      }

      // Upload object
      const metaData = {
        'Content-Type': metadata?.['Content-Type'] || 'application/octet-stream',
        ...metadata
      };

      const result = await this.client.putObject(
        this.bucket,
        key,
        buffer,
        buffer.length,
        metaData
      );

      this.logger.info(
        { 
          bucket: this.bucket, 
          key, 
          size: buffer.length,
          etag: result.etag 
        },
        'Stored object in MinIO'
      );

      // Construct result
      const storageResult: StorageResult = {
        url: `minio://${this.bucket}/${key}`,
        bucket: this.bucket,
        key,
        size: buffer.length,
        etag: result.etag
      };

      return Result.ok(storageResult);
    } catch (error) {
      this.logger.error(
        { error, bucket: this.bucket, key },
        'Failed to store object in MinIO'
      );
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  async getSignedUrl(key: string, expiry: number = 3600): Promise<Result<string, Error>> {
    try {
      const url = await this.client.presignedGetObject(
        this.bucket,
        key,
        expiry
      );

      this.logger.debug(
        { bucket: this.bucket, key, expiry },
        'Generated signed URL'
      );

      return Result.ok(url);
    } catch (error) {
      this.logger.error(
        { error, bucket: this.bucket, key },
        'Failed to generate signed URL'
      );
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  async delete(key: string): Promise<Result<void, Error>> {
    try {
      await this.client.removeObject(this.bucket, key);

      this.logger.info(
        { bucket: this.bucket, key },
        'Deleted object from MinIO'
      );

      return Result.ok(undefined);
    } catch (error) {
      this.logger.error(
        { error, bucket: this.bucket, key },
        'Failed to delete object from MinIO'
      );
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  async checkConnection(): Promise<Result<boolean, Error>> {
    try {
      // Try to list buckets as a connectivity check
      await this.client.listBuckets();
      
      // Check if our bucket exists
      const exists = await this.client.bucketExists(this.bucket);
      
      this.logger.info(
        { bucket: this.bucket, exists },
        'MinIO connection check successful'
      );

      return Result.ok(exists);
    } catch (error) {
      this.logger.error(
        { error },
        'MinIO connection check failed'
      );
      return Result.err(error instanceof Error ? error : new Error('Connection failed'));
    }
  }
}