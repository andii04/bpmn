/**
 * AUTHOR: mrassinger
 * COPYRIGHT: E2E Technologies Ltd.
 */

var Persistency = require('../../../lib/execution/persistency.js').Persistency;
var BPMNProcess = require('../../../lib/execution/process.js').BPMNProcess;
var BPMNProcessDefinition = require('../../../lib/bpmn/processDefinition.js').BPMNProcessDefinition;
var BPMNTask = require("../../../lib/bpmn/tasks.js").BPMNTask;
var BPMNStartEvent = require("../../../lib/bpmn/startEvents.js").BPMNStartEvent;
var BPMNEndEvent = require("../../../lib/bpmn/endEvents.js").BPMNEndEvent;
var BPMNSequenceFlow = require("../../../lib/bpmn/sequenceFlows.js").BPMNSequenceFlow;

var processDefinition = new BPMNProcessDefinition("PROCESS_1", "myProcess");
processDefinition.addFlowObject(new BPMNStartEvent("_2", "MyStart", "startEvent", [], ["_4"]));
processDefinition.addFlowObject(new BPMNTask("_3", "MyTask", "task", ["_4"], ["_6"]));
processDefinition.addFlowObject(new BPMNEndEvent("_5", "MyEnd", "endEvent", ["_6"], []));
processDefinition.addSequenceFlow(new BPMNSequenceFlow("_4", "flow1", "sequenceFlow", "_2", "_3"));
processDefinition.addSequenceFlow(new BPMNSequenceFlow("_6", "flow2", "sequenceFlow", "_3", "_5"));
var persistencyPath = './test/resources/persistency/testProcessEngine';
var persistency = new Persistency({path: persistencyPath});
var processId = "myPersistentProcess_1";
var testPropertyName = "myprop";

exports.testPersistSimpleBPMNProcess = function(test) {

    persistency.cleanAllSync();

    var handler = {
        "MyStart": function(data, done) {
            test.deepEqual(this.getState().tokens,
                [
                    {
                        "position": "MyStart"
                    }
                ],
                "testPersistSimpleBPMNProcess: state at MyTask BEFORE SAVING"
            );done(data);
        },
        "MyTask": function(data, done) {
            test.deepEqual(this.getState().tokens,
                [
                    {
                        "position": "MyTask"
                    }
                ],
                "testPersistSimpleBPMNProcess: state at MyTask BEFORE SAVING"
            );
            this.setProperty("anAdditionalProperty", "Value of an additional property");

            done(data);
        },
        "doneSavingHandler": function(error, savedData) {
            if (error) {
                test.ok(false, "testPersistSimpleBPMNProcess: error at saving SAVING");
                test.done();
            }

            test.deepEqual(savedData,
                {
                    "processInstanceId": "myProcess::myPersistentProcess_1",
                    "data": {
                        "myprop": {
                            "an": "object"
                        },
                        "anAdditionalProperty": "Value of an additional property"
                    },
                    "state": {
                        "tokens": [
                            {
                                "position": "MyTask"
                            }
                        ]
                    },
                    "history": [
                        "MyStart",
                        "MyTask"
                    ],
                    "_id": 1
                },
                "testPersistSimpleBPMNProcess: saved data"
            );

            test.done();
        }
    };

    var bpmnProcess = new BPMNProcess(processId, processDefinition, handler, persistency);
    bpmnProcess.setProperty(testPropertyName, {an: "object"});
    bpmnProcess.sendStartEvent("MyStart");
  };

exports.testLoadSimpleBPMNProcess = function(test) {
    var newBpmnProcess;

    var handler = {
        "MyTaskDone": function(data, done) {
            var state = this.getState();
            test.deepEqual(state.tokens,
                [
                    {
                        "position": "MyTask"
                    }
                ],
                "testPersistSimpleBPMNProcess: state at MyTask AFTER LOADING"
            );
            // data is not in the process client interface. Thus, we have to use the process instance to get it
            test.deepEqual(newBpmnProcess.data,
                {
                    "myprop": {
                        "an": "object"
                    },
                    "anAdditionalProperty": "Value of an additional property"
                },
                "testPersistSimpleBPMNProcess: data at MyTask AFTER LOADING"
            );
            done(data);
        },
        "MyEnd": function(data, done) {
            var state = this.getState();
            test.deepEqual(state.tokens,
                [
                    {
                        "position": "MyEnd"
                    }
                ],
                "testLoadSimpleBPMNProcess: end event"
            );
            done(data);
            test.done();
        }
    };

    var doneLoading = function(error, loadedData) {
        if (!error && !loadedData) {
            test.ok(false, "testLoadSimpleBPMNProcess: there was nothing to load. Did saving data in the previous testcase work?");
            test.done();
        }

        if (error) {
            test.ok(false, "testLoadSimpleBPMNProcess: failed loading. Error: " + error);
            test.done();
        }

        test.equal(loadedData._id, 1, "testLoadSimpleBPMNProcess: _id");
        test.equal(loadedData.processInstanceId, "myProcess::myPersistentProcess_1", "testLoadSimpleBPMNProcess: processInstanceId");
        test.deepEqual(loadedData.history,
            [
                "MyStart",
                "MyTask"
            ],
            "testLoadSimpleBPMNProcess: history"
        );
        test.deepEqual(loadedData.data,
            {
                "myprop": {
                    "an": "object"
                },
                "anAdditionalProperty": "Value of an additional property"
            },
            "testLoadSimpleBPMNProcess: data"
        );
        test.deepEqual(loadedData.state.tokens,
            [
                {
                    "position": "MyTask"
                }
            ],
            "testLoadSimpleBPMNProcess: tokens"
        );

        var myProperty = this.getProperty(testPropertyName);
        test.deepEqual(
            myProperty,
            {
                "an": "object"
            },
            "testLoadSimpleBPMNProcess: get loaded property"
        );

        // deferEvents flag is not in the process client interface. Thus, we have to use the process instance to get it
        test.ok(newBpmnProcess.deferEvents, "testLoadSimpleBPMNProcess: deferEvents");

        // deferredEvents is not in the process client interface. Thus, we have to use the process instance to get it
        var deferredEvents = newBpmnProcess.deferredEvents;
        test.deepEqual(deferredEvents,
            [
                {
                    "type": "taskDoneEvent",
                    "name": "MyTask",
                    "data": {}
                }
            ],
            "testLoadSimpleBPMNProcess: deferred after loading");
    };

    newBpmnProcess = new BPMNProcess(processId, processDefinition, handler, persistency);
    newBpmnProcess.loadState(doneLoading);

    newBpmnProcess.taskDone("MyTask");

};