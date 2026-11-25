#!/bin/sh
set -eu

archive_url="https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-macos-m1-apple-silicon.tar"
archive_sha="4d77c4aa3ad9bd1ea8111f2ac5a4620fe7ebf998d6893bf828d49ccd579c8cb0"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(dirname "$script_dir")
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT HUP INT TERM

curl -L --fail --silent --show-error "$archive_url" -o "$temp_dir/stockfish.tar"
printf '%s  %s\n' "$archive_sha" "$temp_dir/stockfish.tar" | shasum -a 256 -c -
tar -xf "$temp_dir/stockfish.tar" -C "$temp_dir" \
  stockfish/stockfish-macos-m1-apple-silicon stockfish/Copying.txt
mkdir -p "$repo_dir/src-tauri/binaries" "$repo_dir/third_party/stockfish"
install -m 755 "$temp_dir/stockfish/stockfish-macos-m1-apple-silicon" \
  "$repo_dir/src-tauri/binaries/stockfish-aarch64-apple-darwin"
install -m 644 "$temp_dir/stockfish/Copying.txt" "$repo_dir/third_party/stockfish/Copying.txt"
printf '%s\n' "Installed Stockfish 18 for aarch64-apple-darwin."
