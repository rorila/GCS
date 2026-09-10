agent.createLabel('stage_main', 'SekundenLabel', 1, 3, '0');
agent.createTimer('stage_main', 'SekundenTimer', 1, 1, {interval:1000, maxInterval:10, currentInterval:0, enabled:true});
agent.createTask('stage_main', 'SekundenZähler');
agent.addAction('SekundenZähler', 'increment', 'Act_IncLabel', {changes:{'SekundenLabel.text':1}});
agent.connectEvent('stage_main', 'SekundenTimer', 'onTimer', 'SekundenZähler');
