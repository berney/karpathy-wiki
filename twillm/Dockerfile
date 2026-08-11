ARG GOSS_VERSION=0.4.9

# Build stage: Sparse checkout mermaid-tw5 plugin from GitHub
FROM alpine AS mermaid
ARG MERMAID_TW5_REF=32e8282dfd070bdd4605ad8ce7015ea87c5db4d0
RUN <<-EOF
    set -eux
    apk add --no-cache git
    mkdir mermaid-tw5
    cd mermaid-tw5 || exit 1
    git init --initial-branch main
    git remote add origin https://github.com/asophila/mermaid-tw5.git
    git fetch --depth 1 --filter=blob:none origin "${MERMAID_TW5_REF}"
    git sparse-checkout set mermaid-tw5/plugins/mermaid-tw5
    git checkout FETCH_HEAD
    git switch --create main
EOF

# Build stage: Download goss and make it executable
FROM alpine AS goss
ARG GOSS_VERSION
ARG TARGETARCH
RUN <<-EOF
    wget -qO- "https://github.com/goss-org/goss/releases/download/v${GOSS_VERSION}/goss-linux-${TARGETARCH}" > goss
    chmod +x goss
EOF

# Final stage
FROM node:22-alpine3.23

WORKDIR /app

# Install git + CA certs (Alpine's ca-certificates auto-bundles certs)
# Clone twillm (uses bidirectional-filesystem branch of TiddlyWiki5)
RUN <<-EOF
	apk add --no-cache git ca-certificates
	git clone --depth 1 https://github.com/Jermolene/twillm.git . || exit 1
	npm install || exit 1
EOF

EXPOSE 8080

# Add our suped up cli.js - allows user plugins
COPY --link /cli.js /app/cli.js

# Our tiddlywiki.info with our extra plugins
COPY --link /template-wiki/tiddlywiki.info /app/template-wiki/tiddlywiki.info

# Bundle plugins from mermaid-tw5 repo (sparse checked out above)
COPY --link --from=mermaid /mermaid-tw5/mermaid-tw5/plugins/mermaid-tw5 \
    /app/node_modules/tiddlywiki/plugins/asophila/mermaid-tw5/

# Bundle our own local plugins
COPY --link /plugins /app/node_modules/tiddlywiki/plugins/

# goss is a statically-linked musl binary — no shared library deps, runs fine even in distroless.
COPY --link --from=goss /goss /usr/local/bin/goss
# Putting goss file in /app/ as its the working directory of upstream image
COPY --link /goss.yaml /app/
HEALTHCHECK --interval=2s --timeout=5s --retries=10 \
    CMD ["/usr/local/bin/goss", "validate"]

#ENV TIDDLYWIKI_PLUGIN_PATH="/app/plugins"
ENTRYPOINT ["/app/cli.js"]
CMD ["--", "--listen", "host=0.0.0.0"]
