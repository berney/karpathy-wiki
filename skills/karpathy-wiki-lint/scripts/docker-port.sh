#!/bin/sh
# Discover twillm docker-compose port.
# Starts the container if not already running.
# Outputs only the host port number (e.g. "8051").

export PODMAN_COMPOSE_WARNING_LOGS=false

if ! docker compose port twillm 8080 >/dev/null 2>&1; then
    docker compose up --wait twillm >/dev/null 2>&1
fi
docker compose port twillm 8080 | sed 's/.*://'
