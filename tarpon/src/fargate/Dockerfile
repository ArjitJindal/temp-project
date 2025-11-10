FROM --platform=linux/arm64 node:20-alpine
# Upgrade OpenSSL to fix CVE-2025-9232
RUN apk update && apk upgrade --no-cache openssl
WORKDIR /usr/src/app

COPY index.js .
COPY classes.trie .
COPY data .
COPY indic.trie .
COPY use.trie .
COPY data.trie .
