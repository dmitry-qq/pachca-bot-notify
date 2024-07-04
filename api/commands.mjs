import * as Pachca from './pachca.mjs';
import * as API from './api.mjs';
import {
	generateExcel, addTicket, checkCommands,
	sendNext, setTaskSuccess, setTaskCancel
} from './funcs.mjs';
import fs from 'fs';
import { Config } from '../index.mjs';


export function updateCommand(command, req, res, msgdata, isreply=false) {
	Pachca.send(`/messages/${msgdata.parent_message_id}`, {}, pmsgdata => {
		pmsgdata = JSON.parse(pmsgdata).data;
		
		if (!pmsgdata && isreply) return;
		switch(command) {
			/** Создание напоминаний из созданных задач: */
			case 'notifi': {
				if (!isreply) {
					res.sendStatus(200);
					return;
				}
				Pachca.send(`/messages/${pmsgdata.id}/reactions`, { code: '🕐' }, () => {
					Pachca.send(`/tasks`, {
						task: {
							kind: 'reminder',
							content: pmsgdata.content,
							performer_ids: [ req.body.user_id, Config.PID ],
							priority: 2
						}
					}, () => Pachca.send(`/messages/${req.body.id}/reactions`, { 'code': '👍' }, () => res.sendStatus(200)));
				});
			} break;
			
			/** Выполнение задачи: */
			case 'success': {
				if (!isreply) {
					res.sendStatus(200);
					return;
				}
				setTaskSuccess(req.body.id, req.body.entity_id, pmsgdata.content);
				res.sendStatus(200);
			} break;
			
			/** Отмена выполнения задачи: */
			case 'cancel': {
				if (!isreply) {
					res.sendStatus(200);
					return;
				}
				setTaskCancel(req.body.id, req.body.entity_id, pmsgdata.content);
				res.sendStatus(200);
			} break;
			
			/** Переход на следующий этап: */
			case 'next': {
				if (isreply) {
					res.sendStatus(200);
					return;
				}
				
				
				sendNext(req.body.entity_id, req.body.thread.message_id);
				res.sendStatus(200);
			} break;
			
			/** Информация о текущих невыполненных этапов: */
			case 'info': {
				console.log(command, isreply);
				if (isreply) {
					res.sendStatus(200);
					return;
				}
				API.getDBTasks(req.body.entity_id, tasks => {
					const stages = {};
					tasks = tasks.filter(task => {
						if (!stages[task.stage]) stages[task.stage] = [];
						if (stages[task.stage].filter(x => x.content == task.content).length) return false;
						
						stages[task.stage].push(task);
						return true;
					});
					
					Pachca.sendMessage(req.body.entity_id, `**Осталось:**`, async () => {
						for (const stage of Object.keys(stages)) {
							await (new Promise((lres, rej) => {
								Pachca.sendMessage(req.body.entity_id, `**Этап ${stage}:**`, () => {
									for (const task of stages[stage]) {
										Pachca.send(`/messages/${task.id}`, {}, nrdt => {
											const rdata = JSON.parse(nrdt).data;
											if (!rdata) return;

											Pachca.sendMessage(req.body.entity_id, rdata.content, r => {
												r = JSON.parse(r);
												if (!r) return;
												
												API.addDBTask(r.data.id, req.body.entity_id, task.stage, Date.now(), rdata.content, 0, () => lres(true));
											}, true);
										}, 'GET');
									}
								}, true);
							}));
						}
						res.sendStatus(200);
					}, true);
				});
			} break;
			case 'excel': {
				if (isreply) {
					res.sendStatus(200);
					return;
				}
				generateExcel(req.body.entity_id).then(file => {
					Pachca.sendMessage(req.body.entity_id, "Статистика готова! 🧡", () => {
						fs.rm(file.local, () => {});
						res.sendStatus(200);
					}, true, [file.public]);
				});
			} break;
		}
	}, 'GET');
}