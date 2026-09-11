#!/bin/bash
# Update DuckDNS with this VM's current public IPv4.
# Config: /home/ubuntu/.duckdns/config  (DOMAIN= and TOKEN=)
set -euo pipefail
# shellcheck disable=SC1091
source /home/ubuntu/.duckdns/config
curl -fsS "https://www.duckdns.org/update?domains=${DOMAIN}&token=${TOKEN}&ip="
echo
