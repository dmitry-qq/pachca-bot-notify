import jsonfile from 'jsonfile';
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';

// Локальные модули:
import * as Pachca from './api/pachca.mjs';
import * as API from './api/api.mjs';
import * as Excel from './api/excel.mjs';
import levenshtein from 'js-levenshtein';
import {
	generateExcel, addTicket, checkCommands,
	sendNext, setTaskSuccess, setTaskCancel
} from './api/funcs.mjs';
import { updateCommand } from './api/commands.mjs';

export const Config = jsonfile.readFileSync('./config.json');
const app = express(), port = Config.PORT;

app.use(bodyParser.json());
app.timeout = 300000;
app.use('/stats', express.static('stats'));

const help = '\
 Реакция "👍" - выполняет задачу,\n\
 Если ее снять, то отменяет выполнение задачи!\n\
 Реакция "👎" - прекращает дальнейшее прохождение!\n\
 Если ее снять, то прохождение возобновляется!!\n\n\
 **Команды:**\n\
 **В ответ на задачу:**\n\
 *(готово, сделано, есть, закрыть)*: Выполняет задачу\n\
 *(отмена, открыть)*: Отменяет выполнение задачи\n\
 *(напомни, уведоми)*: Создает напоминание в **Задачи**\n\n\
 **Просто команда в чат:**\n\
 *(следующий, дальше)*: Следующий этап (Даже если не все задачи выполнены)\n\
 *(инфо, что еще, задачи)*: Выводит список всех невыполненных задач\n\
 *(сгенерировать, эксель, excel, статистика)*: Генерирует excel файл с выполнением задач по времени\n\
';

app.post('/webhook/pachca', (req, res) => {
	const { user_id, id, thread, type } = req.body;
	if (user_id == Config.PID) {
		res.sendStatus(200);
		return;
	}
	
	if (type == 'reaction') {
		if (req.body.code != '👍' && req.body.code != '👎') {
			res.sendStatus(200);
			return false;
		}
		
		Pachca.send(`/messages/${req.body.message_id}`, {}, ndata => {
			ndata = JSON.parse(ndata);
			if (!ndata) return;
			
			API.getDBTicket(ndata.data.entity_id, tickets => {
				const ticket = tickets[0];
				if (!ticket) return;
				
				switch(req.body.event) {
					case 'new':
						switch(req.body.code) {
							case '👍':
								if (ticket.closed) return;
								setTaskSuccess(ndata.data.id, ndata.data.entity_id, ndata.data.content, false);
							break;
							case '👎': { // Завершение этапов:
									if (ticket.closed) return;
									API.updateDBTicket(ndata.data.entity_id, ticket.stage, 1, () => {
										Pachca.send(`/messages/${ticket.id}/reactions`, {
											code: '❌'
										}, result => {
											Pachca.sendMessage(ndata.data.entity_id, "Дальнейшее прохождение невозможно!", () => {
												
											}, true);
										}, 'POST');
									});
								
							} break;
						}
					break;
					case 'delete':
						switch(req.body.code) {
							case '👍':
								if (ticket.closed) return;
								setTaskCancel(ndata.data.id, ndata.data.entity_id, ndata.data.content, false);
							break;
							case '👎': {
								if (!ticket.closed) return;
								API.getDBTicket(ndata.data.entity_id, tickets => {
									const ticket = tickets[0];
									if (!ticket) return;
									
									API.updateDBTicket(ndata.data.entity_id, ticket.stage, 0, () => {
										Pachca.send(`/messages/${ticket.id}/reactions`, {
											code: '❌'
										}, result => {
											Pachca.sendMessage(ndata.data.entity_id, "Дальнейшее прохождение возобновлено!", () => {
												
											}, true);
										}, 'DELETE');
									});
								});
							} break;
						}
					break;
				}
				
			});
		}, 'GET');
		res.sendStatus(200);
		return;
	}
	
	/** Создание тикета на нового сотрудника: */
	if (!thread) {
		const regex = /^(?:Новый\sсотрудник|Cотрудник)\s([А-ЯЁа-яё\s-]+)\s([А-ЯЁа-яё\s-]+)(?:\s([А-ЯЁа-яё\s-]+))?,?/i;
		if (!regex.test(req.body.content)) {
			res.sendStatus(200);
			return;
		}
		
		addTicket(id, user_id).then(tdt => {
			API.addDBTicket(id, 1, user_id, tdt.ticket_chat_id, 0, () => {
				Pachca.sendMessage(tdt.ticket_chat_id, `${help}\n**Этапы:**`, () => {
					const stage = 1;
					for (const task of Config.STATUS[stage]) {
						Pachca.sendMessage(tdt.ticket_chat_id, task, tmsg => {
							tmsg = JSON.parse(tmsg);
							if (!tmsg) return;
							API.addDBTask(tmsg.data.id, tdt.ticket_chat_id, stage, Date.now(), task, 0, () => {});
						}, true);
					}
				}, true);
			});
		}).catch(err => console.error(`[ERROR]:\n${err}`));
		res.sendStatus(200);
		return;
	}
	
	/** Команды в комментариях к тикету: */
	Pachca.send(`/messages/${id}`, {}, msgdata => {
		msgdata = JSON.parse(msgdata).data;
		if (!msgdata) return;
		
		API.getDBTicket(req.body.entity_id, ticket => {
			ticket = ticket[0];
			if (!ticket) return;
			
			const command = checkCommands(req.body.content.toLowerCase());
			if (command && ticket.closed && command != 'excel') {
				Pachca.sendMessage(req.body.entity_id, "Тикет закрыт!\nНужно убрать 👎 или отменить одну из задач!", () => res.sendStatus(200), true);
				return;
			}
			
			/** Команды в ответ на сообщения: (Задачи) */
			if (msgdata.parent_message_id) {
				console.log(command);
				updateCommand(command, req, res, msgdata, true);
				return;
			}
			console.log(command);
			updateCommand(command, req, res, msgdata);
		});
	}, 'GET');
});

app.listen(port, () => { console.log(`server is running:${port}`); });