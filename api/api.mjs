import request from 'request';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import FormData from 'form-data';

const SQLite3 = sqlite3.verbose();

let isDBConnect = false;
let db = new SQLite3.Database('./db.db', err => {
	if (err) {
		console.error(err.message);
		return;
	}
	console.log('База данных подключена!');
});
db.serialize(() => {
	isDBConnect = true;
});

export function send(token, url, method, data, success) {
	request({
		uri: url,
		body: JSON.stringify(data),
		method: method,
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		}
	}, (err, res) => {
			if (err) {
				console.error(err);
				return;
			}
			if (success)
				success(res.body);
	});
}

export function addDBTask(id, tid, stage, date, content, closed, func) {
	if (!isDBConnect) return false;
	db.all(`INSERT INTO tasks (id, tid, stage, date, content, closed) VALUES (${id}, '${tid}', ${stage}, ${date}, '${content}', ${closed})`, (err, result) => {		
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func)
			func(result);
	});
}

export function addDBTicket(id, stage, uid, cid, closed, func) {
	if (!isDBConnect) return false;
	db.all(`INSERT INTO tickets (id, stage, uid, cid, closed) VALUES (${id}, ${stage}, ${uid}, ${cid}, ${closed})`, (err, result) => {		
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func)
			func(result);
	});
}

export function updateDBTicket(cid, stage, closed, func) {
	if (!isDBConnect) return false;
	db.all(`UPDATE tickets SET stage='${stage}',closed=${closed} WHERE cid='${cid}'`, (err, result) => {
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func) {
			func();
		}
	});
}

export function updateDBTask(tid, content, closed, date, func) {
	if (!isDBConnect) return false;
	db.all(`UPDATE tasks SET closed='${closed}', date='${date}' WHERE tid='${tid}' AND content='${content}'`, (err, result) => {
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func) {
			db.all(`SELECT id, stage from tasks WHERE tid=${tid} AND content='${content}' AND date='${date}' AND closed='${closed}'`, (err, res) => {
				if (err) {
					return false;
				}
				func(res);
			});
		}
	});
}

export function getDBTasks(tid, func, closed=0) {
	if (!isDBConnect) return false;
	db.all(`SELECT id, stage, content, date from tasks WHERE tid='${tid}' AND closed=${closed}`, (err, result) => {
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func)
			func(result);
	});
}

export function getDBTask(id, func) {
	if (!isDBConnect) return false;
	db.all(`SELECT id, stage, content from tasks WHERE id='${id}'`, (err, result) => {
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func)
			func(result);
	});
}

export function getDBTicket(cid, func) {
	if (!isDBConnect) return false;
	db.all(`SELECT * from tickets WHERE cid='${cid}'`, (err, result) => {
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func)
			func(result);
	});
}

export function checkNextStage(tid, stage, func) {
	if (!isDBConnect) return false;
	db.all(`SELECT id, stage from tasks WHERE tid='${tid}' AND closed=0 AND stage=${stage}`, (err, result) => {
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func)
			func(result.length ? false : true);
	});
}



/*
export function removeDBRating(platform, id, func) {
	if (!isDBConnect) return false;
	db.all(`UPDATE ${platform} SET rating=0 WHERE message_id='${id}' AND rating=1`, (err, result) => {
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func)
			func(result);
	});
}

export function getDBTask(id, func) {
	if (!isDBConnect) return false;
	db.all(`SELECT * from tasks WHERE id='${id}'`, (err, result) => {
		if (err) {
			console.log(err.message);
			return false;
		}
		if (func)
			func(result);
	});
}*/