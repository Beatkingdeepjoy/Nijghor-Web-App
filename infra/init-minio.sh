#!/bin/sh
set -e

echo "Waiting for MinIO to become available..."
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  sleep 1
done

echo "Creating bucket: nijghor-media"
mc mb --ignore-existing local/nijghor-media

echo "Setting 30-day lifecycle auto-purge on encrypted media blobs..."
mc ilm rule add --expire-days 30 local/nijghor-media || true

echo "MinIO initialization completed successfully."
