#!/bin/sh
set -eu
# Persistent disks are mounted after image build. Prepare only our data directory.
mkdir -p /app/data
chown node:node /app/data
exec runuser -u node -- node /app/src/server.ts
