#!/usr/bin/env bash
# 生成服务器 deploy/.env（由 api-ci deploy job 调用）。
# DASHSCOPE_API_KEY、DASHVECTOR_ENDPOINT 等均来自 GitHub Actions vars（按 environment 区分 dev/prod）。
set -euo pipefail

SMS_REGION="${ALIYUN_SMS_REGION:-cn-hangzhou}"
HUOSHAN_BASE="${HUOSHAN_BASE_URL:-https://ark.cn-beijing.volces.com/api/v3}"
DB_NAME="${DB_NAME:-ideaevo_dev}"
FRONTEND_URL="${FRONTEND_URL:-http://121.40.176.39:3001}"

DV_ENDPOINT="${DASHVECTOR_ENDPOINT:-}"
if [ -n "$DV_ENDPOINT" ] && [[ ! "$DV_ENDPOINT" =~ ^https?:// ]]; then
  DV_ENDPOINT="https://${DV_ENDPOINT}"
fi

{
  echo "DB_HOST=${DB_ADDRESS}"
  echo "DB_PORT=3306"
  echo "DB_USER=${DB_USERNAME}"
  echo "DB_PASSWORD=${DB_PASSWORD}"
  echo "DB_NAME=${DB_NAME}"
  echo "PORT=8080"
  echo "JWT_SECRET=${JWT_SECRET}"
  echo "JWT_EXPIRY=24h"
  if [ -n "${HUOSHAN_API_KEY:-}" ]; then
    echo "HUOSHAN_API_KEY=${HUOSHAN_API_KEY}"
    echo "HUOSHAN_BASE_URL=${HUOSHAN_BASE}"
    if [ -n "${HUOSHAN_TEXT_MODEL:-}" ]; then
      echo "HUOSHAN_TEXT_MODEL=${HUOSHAN_TEXT_MODEL}"
    fi
  else
    echo "LLM_API_KEY=${DASHSCOPE_API_KEY}"
    echo "LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1"
    echo "LLM_MODEL=qwen-plus"
  fi
  echo "DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}"
  echo "FRONTEND_URL=${FRONTEND_URL}"
  echo "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}"
  echo "API_URL=http://api:8080"
  echo "ALIYUN_SMS_SIGN_NAME=${ALIYUN_SMS_SIGN_NAME:-}"
  echo "ALIYUN_SMS_TEMPLATE_CODE=${ALIYUN_SMS_TEMPLATE_CODE:-}"
  echo "ALIYUN_SMS_REGION=${SMS_REGION}"
  echo "ALIYUN_SMS_ENDPOINT=${ALIYUN_SMS_ENDPOINT:-}"
  echo "ALIYUN_SMS_USE_DEFAULT_CREDENTIAL=1"
  echo "ALIYUN_SMS_ACCESS_KEY_ID=${ALIYUN_SMS_ACCESS_ID:-}"
  echo "ALIYUN_SMS_ACCESS_KEY_SECRET=${ALIYUN_SMS_ACCESS_SECRET:-}"
  echo "VECTOR_BACKEND=${VECTOR_BACKEND:-dashvector}"
  echo "DASHVECTOR_ENDPOINT=${DV_ENDPOINT}"
  echo "DASHVECTOR_METRIC=cosine"
  echo "VECTOR_INDEX_IDEAS=ideas"
  echo "EMBEDDING_MODEL=text-embedding-v4"
  echo "EMBEDDING_DIMENSIONS=1536"
  echo "ALIYUN_VECTOR_BUCKET=ideaevo-vectors-prod"
  echo "ALIYUN_VECTOR_REGION=cn-shanghai"
  echo "ALIYUN_VECTOR_ACCOUNT_ID=1866841989078847"
  echo "ALIYUN_ASSETS_BUCKET=ideaevo"
  echo "ALIYUN_ASSETS_REGION=cn-shanghai"
}
