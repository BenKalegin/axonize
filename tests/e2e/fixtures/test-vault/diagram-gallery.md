# Diagram Gallery

This document is a vault-level fixture for testing diagram rendering, AI edits, and the future CloudDiagram visual editor.

## Mermaid Class Diagram With Axonize Layout

```mermaid
---
x-axonize:
  version: 1
  editor: clouddiagram
  layout:
    nodes:
      User: { x: 80, y: 120, width: 160, height: 80, locked: true }
      Order: { x: 360, y: 120, width: 170, height: 80 }
      PaymentService: { x: 660, y: 120, width: 210, height: 80 }
      Inventory: { x: 360, y: 300, width: 180, height: 80 }
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
direction LR
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

## Mermaid Gantt Chart

```mermaid
gantt
    title Diagram Editing Milestones
    dateFormat  YYYY-MM-DD
    section Authoring
    Draft gallery examples      :done,    draft, 2026-04-01, 2026-04-03
    Review Mermaid coverage     :active,  review, 2026-04-04, 2026-04-05
    section Rendering
    Validate visual editor flow :         visual, 2026-04-06, 2026-04-08
    Ship gallery fixture        :         ship,   2026-04-09, 2026-04-10
```

## Mermaid Pie Chart

```mermaid
pie showData
    title Diagram Block Coverage
    "Mermaid" : 15
    "PlantUML" : 1
    "Graphviz" : 1
    "D2" : 1
    "BPMN" : 1
```

## Mermaid User Journey

```mermaid
journey
    title Diagram Authoring Journey
    section Draft
      Write markdown diagram: 5: User
      Ask AI for a revision: 4: User, AI Agent
    section Edit
      Open visual editor: 5: User
      Adjust node spacing: 4: User, CloudDiagram
    section Save
      Persist updated metadata: 5: Axonize
```

## Mermaid Git Graph

```mermaid
gitGraph
   commit id: "draft"
   branch visual-editor
   checkout visual-editor
   commit id: "layout"
   checkout main
   commit id: "docs"
   merge visual-editor id: "sync"
```

## Mermaid Mindmap

```mermaid
mindmap
  root((Axonize diagrams))
    Mermaid
      Class layout
      Flowcharts
      State transitions
    Visual editing
      Node positions
      Metadata sync
    Export
      Markdown source
      Rendered SVG
```

## Mermaid Timeline

```mermaid
timeline
    title Diagram Roadmap
    2026 Q1 : Markdown gallery
            : Mermaid renderer
    2026 Q2 : Visual editor metadata
            : AI diagram edits
    2026 Q3 : Export workflows
            : Collaboration review
```

## Mermaid Quadrant Chart

```mermaid
quadrantChart
    title Diagram Feature Priorities
    x-axis Low effort --> High effort
    y-axis Low impact --> High impact
    quadrant-1 Strategic bets
    quadrant-2 Major investments
    quadrant-3 Fill-ins
    quadrant-4 Quick wins
    Visual editor: [0.72, 0.86]
    Markdown preview: [0.25, 0.78]
    Export formats: [0.58, 0.52]
    Theme presets: [0.22, 0.38]
```

## Mermaid Requirement Diagram

```mermaid
requirementDiagram
    requirement render_gallery {
        id: RD-1
        text: Diagram gallery examples render in Axonize
        risk: medium
        verifymethod: test
    }

    element markdown_view {
        type: component
    }

    markdown_view - satisfies -> render_gallery
```

## Mermaid Block Diagram

```mermaid
block-beta
  columns 3
  draft["Draft"] review["Review"] save["Save"]
  draft --> review
  review --> save
```

## Mermaid XY Chart

```mermaid
xychart-beta
    title "Diagram Render Checks"
    x-axis [Class, Flow, Sequence, State, ER]
    y-axis "Checks" 0 --> 5
    bar [5, 5, 5, 5, 5]
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

## AWS Deployment Diagram

```mermaid
---
x-axonize:
  version: 1
  editor: clouddiagram
  layout:
    nodes:
      Users: { x: 60, y: 320, width: 120, height: 60 }
      Route53: { x: 260, y: 140, width: 160, height: 60 }
      CloudFront: { x: 260, y: 240, width: 180, height: 60 }
      WAF: { x: 260, y: 340, width: 140, height: 60 }
      ALB: { x: 520, y: 140, width: 200, height: 60 }
      APIGW: { x: 520, y: 280, width: 180, height: 60 }
      Cognito: { x: 520, y: 420, width: 160, height: 60 }
      APIService: { x: 800, y: 60, width: 180, height: 60 }
      WorkerService: { x: 800, y: 180, width: 200, height: 60 }
      AuthService: { x: 800, y: 300, width: 180, height: 60 }
      SchedulerService: { x: 800, y: 420, width: 220, height: 60 }
      RDS_Primary: { x: 1080, y: 60, width: 200, height: 60 }
      RDS_Replica: { x: 1080, y: 180, width: 220, height: 60 }
      DynamoDB: { x: 1080, y: 300, width: 160, height: 60 }
      ElastiCache: { x: 1080, y: 420, width: 220, height: 60 }
      S3_Assets: { x: 1080, y: 540, width: 180, height: 60 }
      S3_Backups: { x: 1080, y: 660, width: 180, height: 60 }
      SQS: { x: 1360, y: 160, width: 140, height: 60 }
      SNS: { x: 1360, y: 280, width: 140, height: 60 }
      EventBridge: { x: 1360, y: 400, width: 180, height: 60 }
      LambdaProcessor: { x: 1600, y: 100, width: 220, height: 60 }
      LambdaAuthorizer: { x: 1600, y: 240, width: 220, height: 60 }
      LambdaNotifier: { x: 1600, y: 380, width: 200, height: 60 }
      SecretsManager: { x: 1880, y: 80, width: 220, height: 60 }
      ParameterStore: { x: 1880, y: 200, width: 220, height: 60 }
      KMS: { x: 1880, y: 320, width: 140, height: 60 }
      ECR: { x: 1880, y: 440, width: 140, height: 60 }
      CloudWatch: { x: 2140, y: 160, width: 180, height: 60 }
      XRay: { x: 2140, y: 300, width: 160, height: 60 }
      NATGateway: { x: 2140, y: 440, width: 200, height: 60 }
      IGW: { x: 2140, y: 560, width: 220, height: 60 }
---
flowchart LR
    subgraph Internet["Internet"]
        Users(["Users"])
    end
    subgraph Edge["Edge"]
        Route53["Route 53"]
        CloudFront["CloudFront CDN"]
        WAF["AWS WAF"]
    end
    subgraph Ingress["Ingress"]
        ALB["App Load Balancer"]
        APIGW["API Gateway"]
        Cognito["Cognito"]
    end
    subgraph Compute["ECS Cluster — us-east-1"]
        APIService["API Service"]
        WorkerService["Worker Service"]
        AuthService["Auth Service"]
        SchedulerService["Scheduler Service"]
    end
    subgraph Data["Data"]
        RDS_Primary[("RDS Primary")]
        RDS_Replica[("RDS Read Replica")]
        DynamoDB[("DynamoDB")]
        ElastiCache[("ElastiCache / Redis")]
        S3_Assets[("S3 — Assets")]
        S3_Backups[("S3 — Backups")]
    end
    subgraph Messaging["Messaging"]
        SQS["SQS"]
        SNS["SNS"]
        EventBridge["EventBridge"]
    end
    subgraph Serverless["Serverless"]
        LambdaProcessor["Lambda Processor"]
        LambdaAuthorizer["Lambda Authorizer"]
        LambdaNotifier["Lambda Notifier"]
    end
    subgraph Security["Security and DevOps"]
        SecretsManager["Secrets Manager"]
        ParameterStore["Parameter Store"]
        KMS["KMS"]
        ECR["ECR"]
    end
    subgraph Observability["Observability"]
        CloudWatch["CloudWatch"]
        XRay["X-Ray"]
    end
    subgraph Network["Network"]
        NATGateway["NAT Gateway"]
        IGW["Internet Gateway"]
    end

    Users --> Route53
    Route53 --> CloudFront
    CloudFront --> WAF
    WAF --> ALB
    WAF --> APIGW
    ALB --> APIService
    ALB --> AuthService
    APIGW --> LambdaAuthorizer
    APIGW --> LambdaProcessor
    Cognito -.-> AuthService
    APIService --> RDS_Primary
    APIService --> ElastiCache
    APIService --> DynamoDB
    APIService --> S3_Assets
    APIService --> SQS
    WorkerService --> SQS
    WorkerService --> RDS_Primary
    WorkerService --> S3_Backups
    AuthService --> Cognito
    AuthService --> RDS_Primary
    SchedulerService --> EventBridge
    EventBridge --> LambdaProcessor
    EventBridge --> LambdaNotifier
    SQS --> LambdaProcessor
    SNS --> LambdaNotifier
    LambdaProcessor --> DynamoDB
    LambdaProcessor --> S3_Backups
    LambdaProcessor --> SNS
    RDS_Primary --> RDS_Replica
    APIService --> SecretsManager
    WorkerService --> SecretsManager
    SecretsManager --> KMS
    ParameterStore --> KMS
    ECR --> APIService
    ECR --> WorkerService
    ECR --> AuthService
    ECR --> SchedulerService
    APIService --> CloudWatch
    WorkerService --> CloudWatch
    LambdaProcessor --> XRay
    NATGateway --> IGW
```
