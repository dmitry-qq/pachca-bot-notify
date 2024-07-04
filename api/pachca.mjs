import { send as APIsend } from './api.mjs';
import { Config } from '../index.mjs';

import FormData from 'form-data';
import request from 'request';

export function sendWithFiles(url, data, success) {
	data.submit(url, (err, res) => {
		if (err) {
			console.error(err.message);
			return;
		}
		if (success)
			success(res);
		res.resume();
	});
}

/**
	Отправка запросов к API
	
	@param { string } query Метод API
	@param { object } data Данные для запроса
	@param { function } func Callback-функция
	@param { string } [method=POST] Тип запроса
*/
export const send = (query, data, func, method='POST') => APIsend(
	Config.PTOKEN,
	'https://api.pachca.com/api/shared/v1/' + query,
	method,
	data,
	func
);

/**
	Отправка сообщения в пачку
	
	@param { number } entityID ID чата или сообщения для отправки
	@param { string } message Сообщение
	@param { array } files Файлы для прикрепления
	@param { function } func Callback-функция
	@param { bool } thread Ответ в чат или новое сообщение
*/
/**
	Отправка сообщения в пачку
	
	@param { number } entityID ID чата или сообщения для отправки
	@param { string } message Сообщение
	@param { array } files Файлы для прикрепления
	@param { function } func Callback-функция
	@param { bool } thread Ответ в чат или новое сообщение
*/
export function sendMessage(chatid, message, func, thread, files) {
	const type = thread ? 'thread' : 'discussion';
	if (!files || !files.length) {
		// Отправка сообщения без вложения:
		send('messages', {
			message: {
				entity_id: chatid,
				content: message,
				entity_type: type
			}
		}, func);
		return;
	}
	
	// Отправка сообщения с вложением:
	send('uploads', {}, e => {
		const data = JSON.parse(e);
		if (!data) return;
		
		const maxfiles = files.length,
			_files = [];
		
		for (let i = 0; i < maxfiles; i++) {
			const file = files[i];
			
			const fileURL = file.split('/');
			const filename = fileURL[fileURL.length - 1].split('.').map(x => {
				x = decodeURIComponent(x);
				return decodeURIComponent(x).split('?')[0];
			}).join('.');
			let filetype = filename.split('.').slice(-1).pop().toLowerCase();
			
			switch(filetype) {
				default: filetype = 'file'; break;
				case 'png':
					case 'jpeg':
						case 'jpg':
					filetype = 'image';
				break;
			}
			
			let filepath = data.key.replace('${filename}', encodeURIComponent(filename));
			const formData = new FormData(),
					keys = ['Content-Disposition', 'acl', 'policy',
							'x-amz-credential', 'x-amz-algorithm',
							'x-amz-date', 'x-amz-signature', 'key'];
			for (const key of keys) formData.append(key, data[key]);
			formData.append('file', request(fileURL.slice(0, fileURL.length - 1).join('/') + `/${encodeURIComponent(filename)}`));
			
			sendWithFiles(data.direct_url, formData, () => {
				_files.push({
					key: filepath,
					name: filename,
					file_type: filetype
				});
				
				if (_files.length >= maxfiles)
					send('messages', {
						message: {
							entity_id: chatid,
							content: message,
							files: _files,
							entity_type: type
						}
					}, func);
			});
		}
	});
}

/**
	Реакция на сообщении
	
	@param { number } message_id ID сообщения
	@param { string } code Реакция
	@param { function } func Callback-функция
*/
export function sendReaction(message_id, code, func) {
	send(`messages/${message_id}/reactions`, {
		code: code
	}, func);
}

/**
	Обработка данных из пачки
	
	@param { object } data Данные из пачки
	@param { function } func Callback-функция
*/
export function update(data, func) {
	console.log(data);
	
	let chatID = data.chat_id;
	if (data.thread)
		chatID = data.thread.message_chat_id;
	
	if (data.type == 'reaction' && data.event != 'new') return;
	if (data.type == 'message') {
		if (data.event != 'new') return;
		if (/^.*? добавил .*? в беседу$|^.*? исключил .*? из беседы$/.test(data.content)) return;
		if (/^.*? присоединил(ась|ся) к беседе$/.test(data.content)) return;
		if (data.user_id == Config.PID) return;
		//if (Config.pachca.chats[chatID].ignore.filter(x => x == data.user_id).length) return;
		if (data.user_id == 1) return;
	}
	
	send(`messages/${data.message_id || data.id}`, {}, messageData => {
		messageData = JSON.parse(messageData);
		if (!messageData) return;
		switch(data.type) {
			// Реакция на сообщении:
			case 'reaction': {
				func({
					type: 'reaction',
					id: messageData.data.id,
					thread_id: messageData.data.entity_id,
					chat_id: messageData.data.chat_id,
					code: data.code,
					user_id: data.user_id,
					originalChatID: chatID
				});
			} break;
			
			// Новое сообщение в пачке:
			case 'message': {
				
				send(`users/${data.user_id}`, {}, userData => {
					userData = JSON.parse(userData);
					if (!userData) return;
					const username = `${userData.data.first_name} ${userData.data.last_name}`;
					
					messageData.data.files = messageData.data.files.map((x, i) => {
						const type = x.name.split('.');
						switch(type[type.length - 1].toLowerCase()) {
							default:
								return `<div class="raw-html-embed"><a href="${x.url}">Файл "${x.name}"</a></div>`;
							break;
							case 'png': case 'jpg': case 'jpeg': case 'gif': case 'bmp': case 'svg':
								return `<img src="${x.url}" alt="image ${i}">`;
							break;
							case 'avi': case 'mp4': case 'mob': case 'mkb': case 'm4b':
							case 'flv':
								return `<div class="raw-html-embed"><video src="${x.url}" controls></video></div>`;
							break;
						}
					});
					
					data.description = data.content + '<br>' + messageData.data.files.join('<br>');
					
					if (!data.thread) {
						// Новая задача:
						func({
							id: data.id,
							type: 'task',
							message: data.content,
							chat_id: data.chat_id,
							description: data.description,
							username: username,
							user_id: data.user_id,
							originalChatID: chatID
						});
						return;
					}
					
					// Новый комментарий:
					func({
						id: data.id,
						type: 'message',
						message: data.content,
						thread_id: data.thread.message_id,
						chat_id: data.chat_id,
						description: data.description,
						username: username,
						user_id: data.user_id,
						originalChatID: chatID
					});
				}, 'GET');
			} break;
		}
	}, 'GET');
}