# Diagram Fixture Gallery

This fixture is a starter set for testing diagram rendering, AI edits, and future visual editing flows.

## Mermaid Class Diagram With Axonize Layout

```mermaid
---
x-axonize:
  version: 1
  editor: clouddiagram
  layout:
    nodes:
      User: { x: 100, y: 100, width: 140, height: 90 }
      Order: { x: 300, y: 100, width: 140, height: 108 }
      PaymentService: { x: 500, y: 100, width: 140, height: 78 }
      Inventory: { x: 700, y: 100, width: 140, height: 78 }
    spacing:
      User-Order: 260
      Order-PaymentService: 300
  presentation:
    steps:
      - highlight: [User]
      - highlight: [User, Order]
      - highlight: [Order, PaymentService, Inventory]
---
classDiagram
direction TB
class User {
  +string id
  +placeOrder()
}
class Order {
  +string id
  +decimal total
  +submit()
}
class PaymentService {
  +authorize(orderId)
  +capture(orderId)
}
class Inventory {
  +reserve(orderId)
  +release(orderId)
}
User --> Order : places
Order --> PaymentService : charges
Order --> Inventory : reserves
```

## Mermaid Flowchart

```mermaid
flowchart TD
    Draft[Draft document] --> AskAI{Ask AI?}
    AskAI -->|Yes| Generate[Generate diagram text]
    AskAI -->|No| Manual[Write diagram manually]
    Generate --> Review[Review result]
    Manual --> Review
    Review --> Visual[Open visual editor]
    Visual --> Save[Save Axonize doc]
```

## Mermaid Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant AX as Axonize
    participant CD as CloudDiagram
    participant AI as AI Agent
    User->>AX: Open diagram block
    AX->>CD: Load Mermaid source and x-axonize layout
    User->>CD: Move nodes visually
    CD-->>AX: Emit updated layout metadata
    User->>AI: Make more space between Order and Inventory
    AI-->>AX: Update x-axonize layout
```

## Mermaid State Diagram

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Generated: AI creates source
    Generated --> VisualEditing: user opens visual editor
    VisualEditing --> Synced: layout saved
    Synced --> Diverged: source changes externally
    Diverged --> Synced: layout reconciled
```

## Mermaid ER Diagram

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : appears_in
    USER {
        string id
        string email
    }
    ORDER {
        string id
        decimal total
    }
    PRODUCT {
        string sku
        string name
    }
```

## PlantUML Sequence Diagram

```plantuml
@startuml
actor User
participant Axonize
participant CloudDiagram
User -> Axonize: Open diagram
Axonize -> CloudDiagram: Load visual editor
CloudDiagram --> Axonize: Save updated metadata
@enduml
```

## Graphviz DOT

```dot
digraph DiagramWorkflow {
  rankdir=LR;
  Mermaid -> Parser;
  Parser -> CloudDiagram;
  CloudDiagram -> Axonize;
  Axonize -> Markdown;
}
```

## D2

```d2
User -> Axonize: opens doc
Axonize -> CloudDiagram: visual edit
CloudDiagram -> Markdown: writes x-axonize metadata
```

## BPMN XML Sketch

```xml
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="diagramReview" name="Diagram Review">
    <bpmn:startEvent id="start" name="Draft created" />
    <bpmn:task id="edit" name="Edit diagram visually" />
    <bpmn:endEvent id="done" name="Saved" />
  </bpmn:process>
</bpmn:definitions>
```
