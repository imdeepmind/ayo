#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

case "${1:-}" in
  dev)
    wails dev
    ;;
  install)
    go mod download
    go mod tidy
    npm --prefix frontend install
    ;;
  lint)
    golangci-lint fmt
    golangci-lint run --fix ./...
    npm --prefix frontend run lint:fix
    ;;
  pc)
    pre-commit run --all-files
    ;;
  *)
    echo "Usage: $0 {dev|install|lint|pc}"
    exit 1
    ;;
esac
