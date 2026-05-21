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

ENTRYPOINT ["/app/cli.js"]
CMD ["/data/vault"]
