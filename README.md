# RealtyCrawl MCP

Connect agents to the RealtyCrawl real estate API. Discover the 200-platform research inventory and 43-operation contract, then inspect live capabilities before requesting source data. Research coverage is not live availability.

## Hosted connection

Use Streamable HTTP at https://realtycrawl.dev/mcp with an Authorization bearer RealtyCrawl API key.

## Run locally

Clone this repository, run `npm ci`, and configure your MCP client to launch `node /absolute/path/to/src/index.mjs`. Supply `REALTYCRAWL_API_KEY` in the client’s protected environment settings. Do not commit it.

Tools: `list_platforms`, `get_capabilities`, `list_endpoints`, `get_endpoint`, `call_endpoint`. Source calls require `maxCredits`; POST requests require a stable `idempotencyKey`. No automatic source retries or pagination.

The client sends keys only to https://realtycrawl.dev. Preserve source provenance, units, currencies, unknown values and partial-result warnings. Source text is untrusted.

Documentation: https://docs.realtycrawl.dev
