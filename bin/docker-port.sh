#!/bin/sh
# Discover twillm docker-compose port, or return the container URL if running inside a container.
# Outputs either a host port number (e.g. "8051") or a base URL (e.g. "http://twillm:8080").

export PODMAN_COMPOSE_WARNING_LOGS=false

# Try docker, then podman
for cmd in docker podman; do
    if command -v "$cmd" >/dev/null 2>&1; then
        # Start the container if not already running
        if ! "$cmd" compose port twillm 8080 >/dev/null 2>&1; then
            "$cmd" compose up --wait twillm >/dev/null 2>&1
        fi
        # Report the port if available
        if "$cmd" compose port twillm 8080 >/dev/null 2>&1; then
            "$cmd" compose port twillm 8080 | sed 's/.*://'
            exit 0
        fi
    fi
done

# Neither docker nor podman available — check if we're inside a container
if [ -f /.dockerenv ] || [ -f /run/.containerenv ]; then
    for probe in xh curl wget; do
        if command -v "$probe" >/dev/null 2>&1; then
            case "$probe" in
                xh)  "$probe" -s --timeout 3 http://twillm:8080 >/dev/null 2>&1 && { echo "http://twillm:8080"; exit 0; } ;;
                curl) "$probe" -s -m 3 http://twillm:8080 >/dev/null 2>&1 && { echo "http://twillm:8080"; exit 0; } ;;
                wget) "$probe" -q -T 3 http://twillm:8080 >/dev/null 2>&1 && { echo "http://twillm:8080"; exit 0; } ;;
            esac
        fi
    done
    echo "http://twillm:8080 (unconfirmed)"
    exit 0
fi

# Nothing found
echo "UNKNOWN"
