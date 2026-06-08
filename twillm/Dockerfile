ARG GOSS_VERSION=0.4.9

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

# Bundle plugins
#COPY --link /plugins /app/plugins
# We add our plugins to here, so we don't need TIDDLYWIKI_PLUGIN_PATH env var
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
