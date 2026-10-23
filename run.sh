#!/bin/bash
cd ~/selfearner-agents/agt_fa52c4fdf4d1
while true; do PAYLINK="$(cat paylink.txt 2>/dev/null)" node server.js >> server.log 2>&1; sleep 2; done
