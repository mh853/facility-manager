#!/bin/bash

SECRET='7r7VQkjb734CNIyqryJrDz9GtmtfRs0dQHrd74bVG00='

curl -s -X POST 'https://facility.blueon-iot.com/api/subsidy-crawler/reanalyze' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${SECRET}" \
  -d '{
    "reanalyze_all": true,
    "batch_size": 10,
    "force": false
  }' | jq '.'
