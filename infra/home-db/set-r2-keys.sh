#!/bin/bash
# Writes the R2 keys of the backup into /etc/leximon/backup.env, so that they pass through neither
# a chat nor a shell history. Usage, from a terminal: ssh -t pve pct exec 102 -- leximon-set-r2-keys
set -eu

ACCOUNT_ID=841cf7b3143f05903b54efcabeaac37a

read -rp "Access Key ID : " key
read -rsp "Secret Access Key : " secret
echo

install -d -m 700 /etc/leximon
umask 077
cat > /etc/leximon/backup.env <<EOF
R2_BUCKET=leximon-backups
RCLONE_CONFIG=/dev/null
RCLONE_CONFIG_R2_TYPE=s3
RCLONE_CONFIG_R2_PROVIDER=Cloudflare
RCLONE_CONFIG_R2_ACCESS_KEY_ID=$key
RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=$secret
RCLONE_CONFIG_R2_ENDPOINT=https://$ACCOUNT_ID.eu.r2.cloudflarestorage.com
RCLONE_S3_NO_CHECK_BUCKET=true
EOF
echo "Clés enregistrées."
