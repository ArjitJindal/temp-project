ARG platform=linux/arm64
FROM --platform=${platform} node:20-alpine

WORKDIR /usr/src/app

COPY index.js .
COPY classes.trie .
COPY data .
COPY indic.trie .
COPY use.trie .
COPY data.trie .
