agent.addObject('stage_main', {className:'TTimer', name:'SekundenTimer', x:1, y:1, interval:1000, enabled:true, maxInterval:10, currentInterval:0});
agent.addObject('stage_main', {className:'TLabel', name:'SekundenLabel', x:1, y:3, width:4, height:1, text:'0'});
agent.createTask('stage_main', 'SekundenZähler');
agent.addAction('SekundenZähler', 'increment', 'Act_IncLabel', {changes:{'SekundenLabel.text':1}});
agent.connectEvent('stage_main', 'SekundenTimer', 'onTimer', 'SekundenZähler');
