/**
 * Reusable instructions injected into LLM system prompts so the model knows
 * which fenced code blocks axonize can render inline.
 *
 * - ```mermaid``` — already universally known by Claude; we just remind the
 *   model that it's available.
 * - ```bpmn``` — BPMN 2.0 XML in the Descriptive subset. doodles-bpmn handles
 *   parsing + auto-layout when BPMNDI is absent, so the model can emit
 *   semantic XML without computing coordinates.
 */

const BPMN_FEW_SHOT_EXAMPLE = `\`\`\`bpmn
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1">
  <bpmn:process id="Process_Order" isExecutable="true">
    <bpmn:startEvent id="Start" name="Order placed"/>
    <bpmn:userTask id="Review" name="Review order"/>
    <bpmn:exclusiveGateway id="Decide" name="Approve?"/>
    <bpmn:serviceTask id="Ship" name="Ship order"/>
    <bpmn:endEvent id="Done" name="Order shipped"/>
    <bpmn:endEvent id="Rejected" name="Order rejected"/>
    <bpmn:sequenceFlow id="F1" sourceRef="Start" targetRef="Review"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Review" targetRef="Decide"/>
    <bpmn:sequenceFlow id="F3" sourceRef="Decide" targetRef="Ship" name="yes"/>
    <bpmn:sequenceFlow id="F4" sourceRef="Ship" targetRef="Done"/>
    <bpmn:sequenceFlow id="F5" sourceRef="Decide" targetRef="Rejected" name="no"/>
  </bpmn:process>
</bpmn:definitions>
\`\`\``;

const BPMN_SUPPORTED_ELEMENTS = [
    "Activities: <bpmn:task>, <bpmn:userTask>, <bpmn:serviceTask>, <bpmn:subProcess>, <bpmn:callActivity>",
    "Events: <bpmn:startEvent>, <bpmn:endEvent>, <bpmn:intermediateThrowEvent>, <bpmn:intermediateCatchEvent> with optional <bpmn:messageEventDefinition>, <bpmn:timerEventDefinition>, <bpmn:terminateEventDefinition>",
    "Gateways: <bpmn:exclusiveGateway>, <bpmn:parallelGateway>, <bpmn:inclusiveGateway>, <bpmn:eventBasedGateway>",
    "Flows: <bpmn:sequenceFlow> (within a pool, with optional <bpmn:conditionExpression>), <bpmn:messageFlow> (between pools)",
    "Containers: <bpmn:collaboration> with <bpmn:participant> (pool) and processRef; <bpmn:laneSet> with <bpmn:lane> + <bpmn:flowNodeRef>",
].join("\n  - ");

/**
 * Single instruction block to inject into a system prompt. Tells the model:
 * 1. Both mermaid and BPMN blocks render inline.
 * 2. BPMN 2.0 Descriptive subset, no DI required (auto-layout fills it in).
 * 3. Use the bpmn: namespace; foreign-namespace extensions are not required.
 */
export const DIAGRAM_BLOCKS_INSTRUCTION = [
    "## Diagrams",
    "",
    "axonize renders these fenced code blocks inline:",
    "- ```mermaid``` — flowcharts, sequence diagrams, class diagrams, xychart-beta, etc. Use for ad-hoc visuals where the diagram is data, not a process specification.",
    "- ```bpmn``` — BPMN 2.0 XML for business processes, workflows, and approval flows. Prefer this over mermaid flowcharts whenever the diagram represents a process with tasks, gateways, events, lanes, or pools.",
    "",
    "When emitting BPMN:",
    "- Use the BPMN 2.0 Descriptive subset:",
    `  - ${BPMN_SUPPORTED_ELEMENTS}`,
    "- BPMNDI (shape coordinates) is OPTIONAL — emit only the semantic XML, the renderer auto-lays-out diagrams that arrive without DI.",
    "- Use the bpmn: namespace prefix on the root <bpmn:definitions>.",
    "- Keep ids stable and meaningful (e.g. Review, Approve, Ship) so condition expressions and message flows reference them clearly.",
    "- Do NOT emit Camunda, Zeebe, or other vendor extensions unless explicitly asked.",
    "",
    "Few-shot BPMN example:",
    "",
    BPMN_FEW_SHOT_EXAMPLE,
].join("\n");
