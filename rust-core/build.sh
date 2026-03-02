#!/usr/bin/env bash

# SaurioPDF - Build Script for WASM Module
# This script compiles the Rust code to WebAssembly

set -e

echo "🦕 Building SaurioPDF WASM module..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if rustup is installed
if ! command -v rustup &> /dev/null; then
    echo -e "${RED}Error: rustup is not installed${NC}"
    echo "Install it from https://rustup.rs/"
    exit 1
fi

# Check if wasm-bindgen-cli is installed
if ! command -v wasm-bindgen &> /dev/null; then
    echo -e "${BLUE}Installing wasm-bindgen-cli...${NC}"
    cargo install wasm-bindgen-cli
fi

# Add wasm32 target if not present
if ! rustup target list --installed | grep -q 'wasm32-unknown-unknown'; then
    echo -e "${BLUE}Adding wasm32-unknown-unknown target...${NC}"
    rustup target add wasm32-unknown-unknown
fi

# Build the WASM module
echo -e "${BLUE}Compiling Rust to WASM...${NC}"
cargo build --target wasm32-unknown-unknown --release

# Generate JavaScript bindings
echo -e "${BLUE}Generating JavaScript bindings...${NC}"
wasm-bindgen target/wasm32-unknown-unknown/release/sauriopdf_core.wasm \
    --out-dir pkg \
    --target web \
    --typescript

# Optimize WASM (if wasm-opt is available)
if command -v wasm-opt &> /dev/null; then
    echo -e "${BLUE}Optimizing WASM with wasm-opt...${NC}"
    wasm-opt -Oz --enable-mutable-globals \
        pkg/sauriopdf_core_bg.wasm \
        -o pkg/sauriopdf_core_bg.wasm
else
    echo -e "${BLUE}wasm-opt not found, skipping optimization${NC}"
    echo "Install binaryen for WASM optimization: https://github.com/WebAssembly/binaryen"
fi

# Display file sizes
echo -e "${GREEN}✓ Build complete!${NC}"
echo ""
echo "Generated files:"
ls -lh pkg/sauriopdf_core* | awk '{print "  " $9 " - " $5}'

echo ""
echo -e "${GREEN}WASM module built successfully!${NC}"
echo "Location: pkg/sauriopdf_core_bg.wasm"
