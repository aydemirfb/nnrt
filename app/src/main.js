joint.setTheme('bpmn');

var example = window.example;
var gdAuth = window.gdAuth;
var gdLoad = window.gdLoad;
var gdSave = window.gdSave;
var inputs = window.inputs;
var toolbarConfig= window.toolbarConfig;

var graph = new joint.dia.Graph({ type: 'bpmn' });

var commandManager = new joint.dia.CommandManager({ graph: graph });

var keyboard = new joint.ui.Keyboard();

var jsonOfGraph = {};

let smtOutput = '';
let preference = `
;;%%\r\n;;Preference:\r\n`;
let optimization = ` ;;%%\r\n;;Optimization:\r\n;;%%\r\n(maximize (+ NCC PVC))\r\n(maximize (+ pen.auto ben.auto))\r\n(minimize unsat_requirements)\r\n(check-sat)\r\n(load-objective-model 0)\r\n(get-model)\r\n(exit)\r\n`;
let scheme = ''



var paper = new joint.dia.Paper({
    width: 2000,
    height: 2000,
    model: graph,
    gridSize: 10,
    defaultLink: new joint.shapes.bpmn.Flow,
    validateConnection: function(cellViewS, magnetS, cellViewT, magnetT, end) {

        // don't allow loop links
        if (cellViewS == cellViewT) return false;

        var view = (end === 'target' ? cellViewT : cellViewS);

        // don't allow link to link connection
        return !view.model.isLink();
    },
    embeddingMode: true,
    frontParentOnly: false,
    defaultAnchor: { name: 'perpendicular' },
    defaultConnectionPoint: { name: 'boundary', args: { sticky: true, stroke: true }},
    validateEmbedding: function(childView, parentView) {
        var Pool = joint.shapes.bpmn.Pool;
        return (parentView.model instanceof Pool) && !(childView.model instanceof Pool);
    }
}).on({

    'blank:pointerdown': function(evt, x, y) {

        if (keyboard.isActive('shift', evt)) {
            selection.startSelecting(evt, x, y);
        } else {
            selection.cancelSelection();
            paperScroller.startPanning(evt, x, y);
        }
    },

    'element:pointerdown': function(cellView, evt) {

        // Select an element if CTRL/Meta key is pressed while the element is clicked.
        if (keyboard.isActive('ctrl meta', evt) && !(cellView.model instanceof joint.shapes.bpmn.Pool)) {
            selection.collection.add(cellView.model);
        }
    },

    'element:pointerup': openTools,
    'link:options': openTools
});

var paperScroller = new joint.ui.PaperScroller({
    autoResizePaper: true,
    padding: 50,
    paper: paper
});

paperScroller.$el.appendTo('#paper-container');
paperScroller.center();

/* SELECTION */

var selection = new joint.ui.Selection({
    paper: paper,
    graph: graph,
    filter: ['bpmn.Pool'] // don't allow to select a pool
}).on({

    'selection-box:pointerdown': function(cellView, evt) {
        // Unselect an element if the CTRL/Meta key is pressed while a selected element is clicked.
        if (keyboard.isActive('ctrl meta', evt)) {
            selection.collection.remove(cellView.model);
        }
    }
});

/* STENCIL */

var stencil = new joint.ui.Stencil({
    graph: graph,
    paper: paper,
    dragEndClone: function(cell) {

        var clone = cell.clone();
        var type = clone.get('type');

        // some types of the elements need resizing after they are dropped
        var sizeMultiplier = { 'bpmn.Pool': 8 }[type];

        if (sizeMultiplier) {
            var originalSize = clone.get('size');
            clone.set('size', {
                width: originalSize.width * sizeMultiplier,
                height: originalSize.height * sizeMultiplier
            });
        }

        return clone;
    }
});

joint.dia.Element.define('bpmn.Event', {
    attrs: {
        body: {
            rx: 20,
            ry: 20,
            refWidth: '40%',
            refHeight: '40%',
            strokeWidth: 1,
            stroke: '#333333',
            fill: '#000000', 
        },
        label: {
            textVerticalAnchor: 'middle',
            textAnchor: 'middle',
            refX: '21%',
            refY: '21%',
            fontSize: 14,
            fill: '#FFFFFF'
        },
        markup: [{
            tagName: 'rect',
            selector: 'body',
        }, {
            tagName: 'text',
            selector: 'label'
        }]
    }
}, {
    markup: [{
        tagName: 'rect',
        selector: 'body',
    }, {
        tagName: 'text',
        selector: 'label'
    }]
});

joint.dia.Element.define('standard.Goal', {
    attrs: {
        body: {
            rx: 20,
            ry: 20,
            refWidth: '100%',
            refHeight: '80%',
            strokeWidth: 2,
            stroke: '#000000',
            fill: '#FFFFFF'
        },
        label: {
            textVerticalAnchor: 'middle',
            textAnchor: 'middle',
            refX: '50%',
            refY: '40%',
            fontSize: 14,
            fill: '#333333'
        },
    }
}, {
    markup: [{
        tagName: 'rect',
        selector: 'body',
    }, {
        tagName: 'text',
        selector: 'label'
    }]
});

stencil.render().$el.appendTo('#stencil-container');

stencil.load([
    new joint.shapes.standard.Goal,
    new joint.shapes.bpmn.Event,
]);

joint.layout.GridLayout.layout(stencil.getGraph(), {
    columns: 100,
    columnWidth: 110,
    rowHeight: 110,
    dy: 20,
    dx: 20,
    resizeToFit: true
});

stencil.getPaper().fitToContent(0, 0, 10);

// Create tooltips for all the shapes in stencil.
stencil.getGraph().get('cells').each(function(cell) {
    new joint.ui.Tooltip({
        target: '.joint-stencil [model-id="' + cell.id + '"]',
        content: cell.get('type').split('.')[1],
        bottom: '.joint-stencil',
        direction: 'bottom',
        padding: 0
    });
});


/* KEYBOARD */

keyboard.on('delete backspace', function() {
    graph.removeCells(selection.collection.toArray());
});

function openTools(cellView) {

    var cell = cellView.model;
    var type = cell.get('type');

    window.inspector = joint.ui.Inspector.create('#inspector-container', {
        cell: cell,
        inputs: inputs[type],
        groups: {
            general: { label: type, index: 1 },
            appearance: { index: 2 }
        }
    });

    if (!cell.isLink() && !selection.collection.contains(cell)) {

        selection.collection.reset([]);
        // Add the cell into the selection collection silently
        // so no selection box is rendered above the cellview.
        selection.collection.add(cell, { silent: true });

        new joint.ui.FreeTransform({
            cellView: cellView,
            allowOrthogonalResize: false,
            allowRotation: false
        }).render();

        var halo = new joint.ui.Halo({
            cellView: cellView,
            theme: 'default',
            boxContent: function(cellView) {
                return cellView.model.get('type');
            }
        });
        halo.render();
        halo.removeHandle('rotate');
        halo.removeHandle('resize');
    }
}

function showStatus(message, type) {
    $('.status').removeClass('info error success').addClass(type).html(message);
    $('#statusbar-container').dequeue().addClass('active').delay(3000).queue(function() {
        $(this).removeClass('active');
    });
}


/* TOOLBAR */

var toolbar = new joint.ui.Toolbar({
    tools: toolbarConfig.tools,
    references: {
        paperScroller: paperScroller,
        commandManager: commandManager
    }
});

let stencilGoals = [];
let stencilRefs = [];

/* CELL ADDED: after the view of the model was added into the paper */
graph.on('add', function(cell, collection, opt) {

    if (!opt.stencil) return;

    // autonaming is happening here

    if (cell.attributes.type == 'standard.Goal') {
        stencilGoals.push({id: cell.id, name: `G${stencilGoals.length}`});
        cell.attr('label/text', `G${stencilGoals.length}`);

    } else if (cell.attributes.type == 'bpmn.Event') {
        stencilRefs.push({id: cell.id, name: `R${stencilRefs.length}`});
        cell.attr('label/text', `R${stencilRefs.length}`);
    }
    
    // open inspector after a new element dropped from stencil
    var view = paper.findViewByModel(cell);
    if (view) openTools(view);
});

graph.on('change', function(eventName, cell) {
    // Mandatory goal management
    if (eventName.attributes.type === 'standard.Goal') {
        if (typeof eventName.changed.attrs != 'undefined') {
            if (typeof eventName.changed.attrs['.label'] != 'undefined') {
                if (typeof eventName.changed.attrs['.label'].mandatory != 'undefined' && eventName.changed.attrs['.label'].mandatory != 'no') {
                    // change color to a more blue color
                    let mandatoryColor = 'blue';
                    eventName.attr('body/fill', mandatoryColor);
                } else {
                    eventName.attr('body/fill', '#FFFFFF');
                }
            }
        }
    }
    // Contribution link management
    if (eventName.attributes.type === 'bpmn.Flow') {
        if (typeof eventName.changed.attrs != 'undefined') {
            if (typeof eventName.changed.attrs['.label'].relation != 'undefined' && eventName.changed.attrs['.label'].relation != 'none') {
                eventName.set('flowType', 'message')
                
                let contributionType = '';

                if (eventName.changed.attrs['.label'].relation === 'PCC') {
                    contributionType = '+C'
                } else if (eventName.changed.attrs['.label'].relation === 'PVC') {
                    contributionType = '+V'
                } else if (eventName.changed.attrs['.label'].relation === 'NCC') {
                    contributionType = '-C'
                } else if (eventName.changed.attrs['.label'].relation === 'NVC') {
                    contributionType = '-V'
                } else if (eventName.changed.attrs['.label'].relation === 'EXC') {
                    contributionType = 'EX'
                } else if (eventName.changed.attrs['.label'].relation === 'PRE') {
                    contributionType = 'PR'
                }
                

                eventName.label(0,{
                    markup: [
                        {
                            tagName: 'circle',
                            selector: 'body'
                        }, {
                            tagName: 'text',
                            selector: 'label'
                        }
                    ],
                    attrs: {
                        label: {
                            text: contributionType,
                            fill: '#000000',
                            fontSize: 14,
                            textAnchor: 'middle',
                            yAlignment: 'middle',
                            pointerEvents: 'none'
                        },
                        body: {
                            ref: 'label',
                            fill: '#ffffff',
                            stroke: '#000000',
                            strokeWidth: 1,
                            refR: 1,
                            refCx: 0,
                            refCy: 0
                        },
                    }
                }
              );
                
            } else {
                eventName.set('flowType', 'normal')
                eventName.removeLabel(0)
            }
        }
    }
});

function smtize() {

    let funs = [];
    let goals = [];
    let targets = [];
    let sources = [];
    let refinements = [];
    let nodes = [];
    let mandatoryGoals = [];
    let contributions = [];
    let i = 1;
    let j = 1;
    let k = 1;

    jsonOfGraph.cells.forEach((cell) => {
        if (cell.type == 'standard.Goal') {
            funs.push(cell.attrs.label.text);
            goals.push({id: cell.id, name: cell.attrs.label.text});
            if (typeof cell.attrs['.label'] !== 'undefined') {
                if (cell.attrs['.label'].mandatory === 'yes') {
                    mandatoryGoals.push(cell.attrs.label.text);
                }
            }
            i++;
        } else if (cell.type == 'bpmn.Event') {
            funs.push(cell.attrs.label.text);
            refinements.push({id: cell.id, name: cell.attrs.label.text});
            j++;
        } else if (cell.type == 'bpmn.Flow') {
            goals.forEach((goal) => {
                if (cell.target.id === goal.id) {
                    targets.push(cell.target.id);
                }
            })
            if (typeof cell.attrs['.label'] !== 'undefined') {
                contributions.push({name: `CCR${k}`, relation: cell.attrs['.label'].relation, weight: cell.attrs['.label'].weight, from: cell.source.id, to: cell.target.id})
                k += 1;
            }
            refinements.forEach((ref) => {
                if (cell.source.id === ref.id) {
                    sources.push(cell.source.id);
                }
            })

            nodes.push({id: cell.id, from: cell.source.id, to: cell.target.id});
        }
    });
    funs = funs.sort();

    // SMT output start
    smtOutput = ''
    smtOutput += `;; activate model generation\r\n(set-option :produce-models true)\r\n(set-option :opt.priority lex)\r\n`

    // Declaration of Goal, Assumption and Refinement Propostions

    smtOutput += `;;%%%%\r\n;Declaration of Goal, Assumption and Refinement Propostions\r\n;%%%%\r\n`;

    funs.forEach((fun) => {
        smtOutput += `(declare-fun ${fun} () Bool) \r\n`;
    });

    contributions.forEach((c) => {
        if (c.relation !== 'EXC' && c.relation !== 'PRE') {
            smtOutput += `(declare-fun ${c.name} () Bool) \r\n`;
        }
    })

    smtOutput += `\r\n\r\n`;

    // Close-world

    smtOutput += `;;%%%%\r\n;Close-world\r\n;%%%%\r\n`;

    let closeWorldPairings = [];
    nodes.forEach((node) => {
        if (targets.includes(node.to) && sources.includes(node.from)) {
            let goalName;
            let refName;
            goals.forEach((goal) => {
                if (goal.id === node.to) {
                    goalName = goal.name;
                }
            })
            refinements.forEach((ref) => {
                if (ref.id === node.from) {
                    refName = ref.name;
                }
            })
            closeWorldPairings.push({ goal: goalName, refinement: refName });
        }
    });

    for (i = 0; i < closeWorldPairings.length; i +=1 ) {
        if (i > 0) {
            if (closeWorldPairings[i].goal != closeWorldPairings[i-1].goal) {
                smtOutput += `)))\r\n(assert (=> ${closeWorldPairings[i].goal}(or ${closeWorldPairings[i].refinement} `;
            } else {
                smtOutput += ` ${closeWorldPairings[i].refinement} `;
            }
        } else {
            smtOutput += `\r\n(assert (=> ${closeWorldPairings[i].goal}(or ${closeWorldPairings[i].refinement}`;
        }
       
    }

    if (closeWorldPairings.length > 0) {
        smtOutput += `)))\r\n`
    }

    smtOutput += `\r\n\r\n`;

    // Refinement-Goal relationships
    
    smtOutput += `;;%%%%\r\n;Refinement-Goal relationships\r\n;%%%%\r\n`;

    refGoalRelations = ``;

    refinements.forEach((ref) => {
        let rightSide = '';
        let leftSide = '';
        nodes.forEach((node) => {
            if (ref.id === node.to) {
                goals.forEach((goal) => {
                    if (goal.id === node.from) {
                        leftSide += goal.name + ' ';
                    }
                });
            } else if (ref.id === node.from) {
                goals.forEach((goal) => {
                    if (goal.id === node.to) {
                        rightSide += goal.name + ' ';
                    }
                });
            }
        });
        refGoalRelations += `(assert (and (= ${ref.name} (and ${leftSide})) (=> ${ref.name} ${rightSide})))\r\n`;
    });

    

    smtOutput += refGoalRelations;

    smtOutput += `\r\n\r\n`;

    // Mandatory goals

    smtOutput += `;;%%%%\r\n;Mandatory goals\r\n;%%%%\r\n`;

    mandatoryGoals.forEach((mandaGoal) =>{
        smtOutput += `(assert ${mandaGoal})\r\n`;
    });

    smtOutput += `\r\n\r\n`;

    // Contributions
    
    smtOutput += `;;%%%%\r\n;Contributions\r\n;%%%%\r\n`;

    contributions.forEach((c) => {
        goals.forEach((goal) => {
            if (goal.id === c.from) {
                c.from = goal.name;
            }
            if (goal.id === c.to) {
                c.to = goal.name;
            }
        });

        console.log({contributions});

        // Handle exclusion and precedence here
        if (c.relation === 'EXC') {
            smtOutput += `(assert (not (and ${c.from} ${c.to})))\r\n`;
        } else if (c.relation === 'PRE') {
            smtOutput += `(assert (=> ${c.to} ${c.from}))\r\n`;
        } else {
            smtOutput += `(assert (= ${c.name} (and ${c.from} ${c.to})))\r\n`;
            if (c.weight === 'undefined') {
                c.weight = 1;
            } 
            if (typeof c.relation === 'undefined') {
                c.relation = 'none';
            }
    
            smtOutput += '(assert-soft (not ' + c.name + ') :weight ' + '1'        + ' :id ' + c.relation + ')\r\n';
        }
        
    });

    graph.attributes.cells.models.forEach((model) => {
        if (typeof model.attributes.attrs['.label'] !== 'undefined') {
            if (typeof model.attributes.attrs['.label'].weight !== 'undefined') {
                if (model.attributes.type === 'standard.Goal') {
                    model.attributes.attrs['.label'].weight.forEach((w) => {
                        console.log(w)
                        smtOutput += '(assert-soft (not ' + model.attributes.attrs.label.text + ') :weight ' + w.attrs.text.body + ' :id ' + w.attrs.text.title + ')\r\n';
                    })
                }
 
            }
        }
    })

    smtOutput += `\r\n\r\n`;

    // Preference

    let leafs = goals
    let tops = goals

    nodes.forEach((node) => {
        goals.forEach((goal) => {
            refinements.forEach((ref) => {
                if (node.to === goal.id && node.from === ref.id) {
                    leafs = leafs.filter(e => e !== goal)
                } else if (node.from === goal.id && node.to === ref.id) {
                    tops = tops.filter(e => e !== goal)
                }
            })
        })
    })


    leafs = [...new Set(leafs)];
    tops = [...new Set(tops)];

    leafs.forEach((leaf) => {
        tops.forEach((top) => {
            if (leaf === top) {
                leafs = leafs.filter(e => e !== leaf)
            }
        })
    })

    leafs.forEach((leaf) => {
        preference += `(assert-soft (not ${leaf.name} ) :id sat_tasks)\r\n`
    })
    
    tops.forEach((top) => {
        preference += `(assert-soft ${top.name} :id unsat_requirements)\r\n`
    })

    console.log({leafs})
    console.log({tops})
    // Real functions
    let reals = '(declare-fun pen.auto () Real)\r\n (assert (= pen.auto (- pen 0)))\r\n (declare-fun ben.auto () Real)\r\n (assert (= ben.auto (- ben 0)))\r\n (declare-fun effort.auto () Real)\r\n (assert (= effort.auto (- effort 0)))\r\n';
    
    // effort
    let eff = '\r\n (assert (<= effort 110))\r\n (assert-soft (<= 90 effort))\r\n'

 
    
    // Optimization scheme

    if (leafs.length < 1) {
        optimization = ` ;;%%\r\n;;Optimization:\r\n;;%%\r\n(maximize (+ NCC PVC))\r\n(maximize (+ pen.auto ben.auto))\r\n(minimize unsat_requirements)\r\n(check-sat)\r\n(load-objective-model 0)\r\n(get-model)\r\n(exit)\r\n`;
    } else {
        optimization = ` ;;%%\r\n;;Optimization:\r\n;;%%\r\n(maximize (+ NCC PVC))\r\n(maximize (+ pen.auto ben.auto))\r\n(minimize unsat_requirements)\r\n(check-sat)\r\n(load-objective-model 0)\r\n(get-model)\r\n(exit)\r\n`;
    }
    scheme = optimization;
    smtOutput += preference ;
    smtOutput += reals;
    smtOutput += eff;
    smtOutput += optimization;

    // Well formedness checks happen here

    // Duplicate check
    if ((new Set(funs)).size !== funs.length) {
        smtOutput = 'There are duplicate values in the goal model, please rename your Goals or Refinements uniquely and try again';
        return
    }
    
    // File download is happening here
    if (document.getElementById('fileName').value === '' || typeof document.getElementById('fileName').value === 'undefined') {
        //download(smtOutput, 'output.smt2', 'text');
        axios.post('http://206.189.12.143/', {
            hey: smtOutput,
          })
          .then(function (response) {
              console.log(graph.attributes.cells.models)
              graph.attributes.cells.models.forEach((model) => {
                if (typeof model.attributes.attrs.label !== 'undefined') {
                    response.data.forEach((result) => {
                        if (result.el === model.attributes.attrs.label.text) {
                            if (result.val === 'false') {
                                model.attr('label/fill', 'red');
                                model.attr('body/stroke', 'red');
                            } else if (result.val === 'true') {
                                model.attr('label/fill', 'green');
                                model.attr('body/stroke', 'green');
                            } 
                        }
                     }) 
                  }
              })
            console.log(response.data);
            let analysisResult = response.data;
          })
          .catch(function (error) {
            console.log(error);
          });
    } else {
        //download(smtOutput, document.getElementById('fileName').value + '.smt2', 'text');
    }


}

function writeToWindow(jsonWindow, analysisResult) {
    jsonWindow.document.write('<pre><code class="javascript"><code class="keyword">' + analysisResult + '</code></pre>');
}

var toolbarCommands = {
    optimizationScheme: function() {
        var windowFeatures = 'menubar=no,location=no,resizable=yes,scrollbars=yes,status=no';
        var windowName = _.uniqueId('optimization');
        var optWindow = window.open('', windowName, windowFeatures);
        optWindow.document.write('<textarea rows="30" cols="50">'+ scheme + '</textarea><br><button>Change scheme</button>');
    },

    downloadSmt2: function() {
        toolbarCommands.toJSON();
        smtize();
        if (document.getElementById('fileName').value === '' || typeof document.getElementById('fileName').value === 'undefined') {
            download(smtOutput, 'output.smt2', 'text');
        } else {
            download(smtOutput, document.getElementById('fileName').value + '.smt2', 'text');
        }
    },

    toJSON: function() {
        let nameOfFile = ''
        smtOutput = ''
        optimization = ''
        preference = ''
        // var windowFeatures = 'menubar=no,location=no,resizable=yes,scrollbars=yes,status=no';
        // var windowName = _.uniqueId('json_output');
        // var jsonWindow = window.open('', windowName, windowFeatures);

        // Keep this if we ever need to see the json output.
        //jsonWindow.document.write(JSON.stringify(graph.toJSON()));

        jsonOfGraph = graph.toJSON();
	var jsonString = JSON.stringify(graph.toJSON());

        // Main function works here
        smtize();
	//if (document.getElementById('fileName').value === '' || typeof document.getElementById('fileName').value === 'undefined') {
        //    download(jsonString, 'output.json', 'text');
        //} else {
        //    download(jsonString, document.getElementById('fileName').value + '.json', 'text');}

	//jsonWindow.document.write('<pre><code class="javascript"><code class="keyword">' + smtOutput + '</code></pre>');

    },
    
    saveJSON: function() {
        let nameOfFile = ''
        smtOutput = ''
        optimization = ''
        preference = ''
        // var windowFeatures = 'menubar=no,location=no,resizable=yes,scrollbars=yes,status=no';
        // var windowName = _.uniqueId('json_output');
        // var jsonWindow = window.open('', windowName, windowFeatures);

        // Keep this if we ever need to see the json output.
        //jsonWindow.document.write(JSON.stringify(graph.toJSON()));

        jsonOfGraph = graph.toJSON();
	var jsonString = JSON.stringify(graph.toJSON());

        // Main function works here
        smtize();
	if (document.getElementById('fileName').value === '' || typeof document.getElementById('fileName').value === 'undefined') {
            download(jsonString, 'output.json', 'text');
        } else {
            download(jsonString, document.getElementById('fileName').value + '.json', 'text');}

	//jsonWindow.document.write('<pre><code class="javascript"><code class="keyword">' + smtOutput + '</code></pre>');

    },

    loadGraph: function() {

        gdAuth(function() {

            showStatus('loading..', 'info');
            gdLoad(function(name, content) {
                try {
                    var json = JSON.parse(content);
                    graph.fromJSON(json);
                    document.getElementById('fileName').value = name.replace(/.json$/, '');
                    showStatus('loaded.', 'success');
                } catch (e) {
                    showStatus('failed.', 'error');
                }
            });

        }, true);
    },

    saveGraph: function() {

        gdAuth(function() {

            showStatus('saving..', 'info');
            var name = document.getElementById('fileName').value;
            gdSave(name, JSON.stringify(graph.toJSON()), function(file) {

                if (file) {
                    showStatus('saved.', 'success');
                } else {
                    showStatus('failed.', 'error');
                }
            });

        }, true);
    }
};

toolbar.on({
    'tojson:pointerclick': toolbarCommands.saveJSON,
    'loadjson:pointerclick': toolbarCommands.loadJSON,
    'optimization:pointerclick': toolbarCommands.optimizationScheme,
    'downloadsmt2:pointerclick': toolbarCommands.downloadSmt2,
    'load:pointerclick': toolbarCommands.loadGraph,
    'save:pointerclick': toolbarCommands.saveGraph,
    'clear:pointerclick': _.bind(graph.clear, graph),
    'print:pointerclick': _.bind(paper.print, paper)
});

toolbar.render().$el.appendTo('#toolbar-container');

toolbar.$('[data-tooltip]').each(function() {

    new joint.ui.Tooltip({
        target: this,
        content: $(this).data('tooltip'),
        top: '.joint-toolbar',
        direction: 'top'
    });
});

// Function to download data to a file
function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}
