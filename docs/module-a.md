---
depends_on: docs/module-b.md#shared-concepts
---

# Payment Engine

The payment engine coordinates billing and retries. It relies on [Shared Concepts](./module-b.md#shared-concepts).

@uses(docs/module-b.md#shared-concepts)

## Retry Strategy

- Retry with exponential backoff
- Stop after three failures

> [!NOTE]
> Retries are intentionally bounded to protect external APIs.

```python
def retry_policy():
    return [1, 2, 4]
```
