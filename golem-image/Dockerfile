# Phase 0.5 — real-inference image (slim path, prebuilt-binary).
#
# Compiling llama.cpp inside Docker on Apple Silicon (under QEMU emulation)
# OOMs with default Docker Desktop memory. Instead we download the official
# prebuilt llama-server binary from llama.cpp's GitHub Releases. No
# compilation; ~2-3 min build.
#
# Base is ubuntu:24.04 because the prebuilt llama-server binary requires
# glibc 2.38+ / GLIBCXX 3.4.32+ — older Ubuntu/Debian fail at load time.
#
# Override the model with --build-arg MODEL_URL=...
# Override the llama.cpp release with --build-arg LLAMA_RELEASE_TAG=bXXXX.

FROM --platform=linux/amd64 ubuntu:24.04

ARG LLAMA_RELEASE_TAG=b4406
ARG MODEL_URL=https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl unzip libgomp1 libstdc++6 file \
    && rm -rf /var/lib/apt/lists/*

# Download and extract the prebuilt llama-server binary.
RUN cd /tmp \
    && URL="https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_RELEASE_TAG}/llama-${LLAMA_RELEASE_TAG}-bin-ubuntu-x64.zip" \
    && echo "Downloading: ${URL}" \
    && curl -fL -o llama.zip "${URL}" \
    && unzip -q llama.zip -d /tmp/llama \
    && find /tmp/llama -type f -name 'llama-server' -exec cp -v {} /usr/local/bin/llama-server \; \
    && find /tmp/llama -type f \( -name '*.so' -o -name '*.so.*' \) -exec cp -vL {} /usr/local/lib/ \; \
    && rm -rf /tmp/llama /tmp/llama.zip \
    && chmod +x /usr/local/bin/llama-server \
    && ldconfig \
    && file /usr/local/bin/llama-server \
    && ls -la /usr/local/bin/llama-server /usr/local/lib/*.so* 2>&1 | head -20

# NOTE: we don't run `llama-server --help` here because the QEMU x86_64
# emulator on Apple Silicon doesn't support AVX2/AVX-512 instructions used by
# the binary. It will run fine on real x86 Golem providers.

# Download the model.
RUN mkdir -p /models \
    && curl -fL -o /models/model.gguf "${MODEL_URL}" \
    && ls -lh /models/model.gguf

WORKDIR /golem/work
EXPOSE 11434
