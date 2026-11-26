#!/usr/bin/env bash
# Stream a consistent MySQL dump into an encrypted CMS envelope.
set -euo pipefail
if [[ $# != 4 ]]; then
    echo 'Usage: backup.sh mysql-options.cnf database recipient-cert.pem output.cms' >&2
    exit 2
fi
umask 077
config=$1
database=$2
cert=$3
output=$4
[[ $database =~ ^[a-zA-Z0-9_]+$ && ! -e $output && ! -d $output ]] || exit 2
temporary=$(mktemp "${output}.XXXXXX")
trap 'rm -f -- "$temporary"' EXIT
mysqldump --defaults-extra-file="$config" --single-transaction --quick --no-tablespaces \
    --set-gtid-purged=OFF "$database" |
    openssl cms -encrypt -binary -stream -aes-256-gcm -outform DER -out "$temporary" "$cert"
ln "$temporary" "$output"
