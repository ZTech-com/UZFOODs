#!/bin/bash
export NODE_ENV=production
export PORT=3001
cd "$(dirname "$0")"
node dist/main
