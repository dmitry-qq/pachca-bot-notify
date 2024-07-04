import * as Pachca from './pachca.mjs';
import * as API from './api.mjs';
import * as Excel from './excel.mjs';
import levenshtein from 'js-levenshtein';
import { Config } from '../index.mjs';
import fs from 'fs';

export async function generateExcel(entity_id) {
	return new Promise((gres, grej) => {
		API.getDBTasks(entity_id, async tasks => {
			const stages = {}, list = [];
			tasks = tasks.sort((a, b) => b.date - a.date).filter(task => {
				if (!stages[task.stage]) stages[task.stage] = [];
				if (stages[task.stage].filter(x => x == task).length) return false;
				
				stages[task.stage].push(task);
			});
			
			for (const stage of Object.keys(stages)) {
				for (const task of stages[stage]) {
					await new Promise((res, rej) => {
						list.push({
							stage: task.stage,
							content: task.content,
							date: new Date(task.date)
						});
						res(true);
					});
				}
			}
			console.log('excel generation...');
			const file = await Excel.saveCVS(list);
			gres({
				public: `http://192.168.227.247:${Config.PORT}${file.replace('.', '')}`,
				local: file			
			});
		}, 1);
	});
}

export async function addTicket(mid, uid) {
	return new Promise((res, rej) => {
		Pachca.send(`messages/${mid}/thread`, {}, strData => {
			const { data } = JSON.parse(strData);
			if (!data) {
				rej(strData);
				return;
			}
			res({
				original_chat_id: data.message_chat_id,
				user_id: uid,
				ticket_chat_id: data.id
			});
		});
	});
}

export function checkCommands(text) {
	for (const command of Object.keys(Config.COMMANDS)) {
		const list = Config.COMMANDS[command].map(x => {
			return {
				percent: Math.min(Math.max(~~((1 - levenshtein(text, x) / x.length) * 100), 0), 100),
				str: x
			}
		}).filter(x => x.percent >= 70);
		if (list.length) {
			return command;
		}
	}
	return false;
}

export function sendNext(entity_id, original_id) {
	API.getDBTicket(entity_id, res => {
		res = res[0];
		if (!res) return false;
		
		const stage = res.stage + 1;			
		if (!Config.STATUS[stage]) {
			Pachca.sendMessage(entity_id, "Сотрудник успешно прошел все этапы! 🎉\nДальше этапов нет!", () => {
				API.getDBTasks(entity_id, tasks => {
					console.log(tasks);
					if (tasks.length) return false;
					API.updateDBTicket(entity_id, stage - 1, 1, () => {
						Pachca.send(`/messages/${original_id}/reactions`, {
							code: '✅'
						}, result => {
							generateExcel(entity_id).then(file => {
								Pachca.sendMessage(entity_id, "Статистика готова! 🧡", () => {
									fs.rm(file.local, () => {});
								}, true, [file.public]);
							});
						}, 'POST');
					});
				});
			}, true);
			return false;
		}
		
		Pachca.sendMessage(entity_id, `**Следующие этапы: (Этап ${stage})**`, () => {
			API.updateDBTicket(entity_id, stage, 0, () => {
				for (let i = 0; i < Config.STATUS[stage].length; i++) {
					const task = Config.STATUS[stage][i];
					Pachca.sendMessage(entity_id, task, r => {
						r = JSON.parse(r);
						if (!r) return;

						API.addDBTask(r.data.id, entity_id, stage, Date.now(), task, 0, () => {});
					}, true);
				}
			});
		}, true);
	});
}

export function setTaskSuccess(id, entity_id, content, isReact=true) {
	API.updateDBTask(entity_id, content.replaceAll('~', ''), 1, Date.now(), (ids) => {
		let isFirst = true;
		for (const nid of ids) {
			Pachca.send(`/messages/${nid.id}/reactions`, {
				code: '✅'
			}, result => {
				Pachca.send(`/messages/${nid.id}`, {
					message: {
						content: `~~${content}~~`,
						files: []
						
					}
				}, (s) => {
					s = JSON.parse(s);
					if (!s) return false;
					if (isFirst) {
						if (isReact) {
							Pachca.send(`/messages/${id}/reactions`, {
								'code': '👍'
							}, r => {
								
							}, 'POST');
						}
						API.getDBTicket(entity_id, d => {
							d = d[0];
							if (!d) return;
							
							API.checkNextStage(entity_id, d.stage, isNext => {
								if (!isNext) return;
								
								console.log(s);
								API.getDBTicket(entity_id, ticket => {
									ticket = ticket[0];
									if (!ticket) return;
									sendNext(entity_id, ticket.id);
								});
							});
						});
						isFirst = false;
					}
				}, 'PUT');
			});
		}
		
	});
}

export function setTaskCancel(id, entity_id, content, isReact=true) {
	API.updateDBTask(entity_id, content.replaceAll('~', ''), 0, Date.now(), (ids) => {
		let isFirst = true;
		for (const nid of ids) {
			Pachca.send(`/messages/${nid.id}/reactions`, {
				code: '✅'
			}, result => {
				Pachca.send(`/messages/${nid.id}`, {
					message: {
						content: `${content.replaceAll('~', '')}`,
						files: []
					}
				}, () => {
					if (isFirst) {
						if (isReact) {
							Pachca.send(`/messages/${id}/reactions`, {
								'code': '👍'
							}, r => {
								
							});
						}
						isFirst = false;
					}
				}, 'PUT');
			}, 'DELETE');
		}
	});
}