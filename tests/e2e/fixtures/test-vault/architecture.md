# Architecture

Axonize uses a **Semantic Document Operating System** (SDOS) approach.

## Core Concepts

### Blocks
Every heading and its content form a semantic block.

### Graph
Blocks are connected via typed edges:
- `contains` — parent/child hierarchy
- `links_to` — wikilinks and markdown links
- `related_to` — same-directory siblings

## Implementation

The system uses [[welcome|the welcome page]] as the entry point.
