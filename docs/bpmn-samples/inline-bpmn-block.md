# BPMN inline rendering test

This file exercises the `\`\`\`bpmn\`\`\`` fenced code block path — the same one the LLM is now told it can emit.

## Simple order workflow

The diagram below has no BPMNDI in the XML; auto-layout fills in coordinates before render.

```bpmn
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_Inline">
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
```

## Events with definitions

```bpmn
<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs_Events">
  <bpmn:process id="Events" isExecutable="true">
    <bpmn:startEvent id="MsgStart" name="Message received">
      <bpmn:messageEventDefinition/>
    </bpmn:startEvent>
    <bpmn:intermediateCatchEvent id="Wait" name="Wait 24h">
      <bpmn:timerEventDefinition/>
    </bpmn:intermediateCatchEvent>
    <bpmn:userTask id="Handle" name="Handle"/>
    <bpmn:endEvent id="Terminate" name="Terminate all">
      <bpmn:terminateEventDefinition/>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="A" sourceRef="MsgStart" targetRef="Wait"/>
    <bpmn:sequenceFlow id="B" sourceRef="Wait" targetRef="Handle"/>
    <bpmn:sequenceFlow id="C" sourceRef="Handle" targetRef="Terminate"/>
  </bpmn:process>
</bpmn:definitions>
```

## Malformed block (expect render error)

```bpmn
this is not BPMN XML
```
