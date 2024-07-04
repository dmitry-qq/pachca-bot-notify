import ExcelJS from 'exceljs';



// Добавляем данные в таблицу
//worksheet.addRow({ stage: 1, task: 'Да', date: new Date() });
//worksheet.addRow({ stage: 2, task: 'Нет', date: new Date() });

export async function saveCVS(tasks) {
	// Создаем новую книгу Excel
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet('Мой лист');

	// Заголовки колонок
	worksheet.columns = [
		{ header: 'Этап', key: 'stage', width: 7 },
		{ header: 'Название', key: 'task', width: 64 },
		{ header: 'Дата завершения', key: 'date', width: 24, style: { numFmt: 'HH:MM:SS dd.mm' } }
	];
	
	const startDate = new Date(tasks[0].date),
			endDate = new Date(tasks[tasks.length - 1].date);
	// Вычитаем даты
	const timeDiff = Math.abs(endDate.getTime() - startDate.getTime());

	// Вычисляем количество дней, часов и минут
	const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
	const hoursDiff = Math.floor((timeDiff % (1000 * 3600 * 24)) / (1000 * 3600));
	const minutesDiff = Math.floor((timeDiff % (1000 * 3600)) / (1000 * 60));
	
	for (const task of tasks) {
		worksheet.addRow({
			stage: task.stage,
			task: task.content,
			date: task.date
		});
	}
	worksheet.addRow({
		stage: '',
		task: 'Заняло времени:',
		date: `${daysDiff} дн. ${hoursDiff} ч. ${minutesDiff} мин.`
	});
	// Сохраняем книгу в файл
	const filename = `./stats/stat_${Date.now()}.xlsx`;
	const file = await workbook.xlsx.writeFile(filename);
	return filename;
}


